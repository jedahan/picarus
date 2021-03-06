#!/usr/bin/env python
from gevent import monkey
monkey.patch_all()
import bottle
bottle.BaseRequest.MEMFILE_MAX = 50 * 1024 ** 2  # 50MB file cap
import argparse
import gevent.queue
import base64
import gevent
import mturk_vision
from users import Users, UnknownUser
from yubikey import Yubikey
import databases
import jobs
import logging
import contextlib
import tables

MAX_CONNECTIONS = 10000  # gevent pool size


def check_version(func):

    def func_raven(*args, **kw):
        try:
            return func(*args, **kw)
        except bottle.HTTPError:
            raise
        except:
            RAVEN.captureException()
            raise
    func2 = func_raven if ARGS.raven else func

    def inner(version, *args, **kw):
        if ARGS.debug:
            print_request()
        if version != VERSION:
            bottle.abort(400)
        return func2(*args, **kw)
    return inner


@contextlib.contextmanager
def thrift_lock():
    try:
        cur_thrift = THRIFT_POOL.get()
        yield cur_thrift
    finally:
        THRIFT_POOL.put(cur_thrift)


@contextlib.contextmanager
def thrift_new():
    yield THRIFT_CONSTRUCTOR()

if __name__ == "__main__":
    logging.basicConfig(level=logging.WARN)
    parser = argparse.ArgumentParser(description='Run Picarus REST Frontend')
    parser.add_argument('--redis_host', help='Redis Host', default='localhost')
    parser.add_argument('--redis_port', type=int, help='Redis Port', default=6379)
    parser.add_argument('--annotations_redis_host', help='Annotations Host', default='localhost')
    parser.add_argument('--annotations_redis_port', type=int, help='Annotations Port', default=6380)
    parser.add_argument('--raven', help='URL to the Raven/Sentry logging server')
    parser.add_argument('--debug', action='store_true')
    parser.add_argument('--local', action='store_true', help='If true, do not use the worker queues and instead run background tasks in server process.')
    parser.add_argument('--reloader', action='store_true', help='If true, enable stopping on git/QUIT changes.  Server should be run in a loop.')
    parser.add_argument('--port', default='80', type=int)
    parser.add_argument('--hadoop_jobtracker', help='Path to Hadoop Jobtracker Webserver', default='http://localhost:50030')
    parser.add_argument('--thrift_server', default='localhost')
    parser.add_argument('--thrift_port', default='9090')
    parser.add_argument('--database', choices=['hbase', 'hbasehadoop', 'redis'], default='hbasehadoop', help='Select which database to use as our backend.  Those ending in hadoop use it for job processing.')
    ARGS = parser.parse_args()
    if ARGS.raven:
        import raven
        RAVEN = raven.Client(ARGS.raven)
    THRIFT_POOL = gevent.queue.Queue()

    USERS = Users(ARGS.redis_host, ARGS.redis_port, 0)
    YUBIKEY = Yubikey(ARGS.redis_host, ARGS.redis_port, 1)
    JOBS = jobs.Jobs(ARGS.redis_host, ARGS.redis_port, 3, ARGS.annotations_redis_host, ARGS.annotations_redis_port)
    # Set necessary globals in tables module
    tables.VERSION = VERSION = 'v0'
    tables.thrift_lock = thrift_lock
    tables.thrift_new = thrift_new
    tables.JOBS = JOBS


def print_request():
    ks = ['auth', 'content_length', 'content_type', 'environ', 'fullpath', 'is_ajax', 'is_xhr', 'method', 'path', 'query_string', 'remote_addr', 'remote_route', 'script_name', 'url', 'urlparts']
    for k in ks:
        print('%s: %s' % (k, str(getattr(bottle.request, k))))

    print('%s: %s' % ('files', (getattr(bottle.request, 'files')).keys()))

    ks = ['forms', 'params', 'query', 'cookies', 'headers']
    for k in ks:
        print('%s: %s' % (k, str(dict(getattr(bottle.request, k)))))


def parse_params_files():
    params = {}
    files = {}
    for x in bottle.request.files:
        files[x] = bottle.request.files[x]
    if "application/json" in bottle.request.content_type:
        # TODO: Is this too strict?  We may want to let json expose real types
        return dict((str(k), str(v)) for k, v in bottle.request.json.items()), files
    for x in set(bottle.request.params) - set(bottle.request.files):
        params[x] = bottle.request.params[x]
    return params, files


def parse_columns():
    columns = {}
    if bottle.request.content_type == "application/json":
        columns = bottle.request.json['columns']
    else:
        try:
            columns = bottle.request.params['columns'].split(',')
        except KeyError:
            columns = []
    return [base64.b64decode(str(x)) for x in columns]


def parse_params():
    if bottle.request.content_type == "application/json":
        # TODO: Is this too strict?  We may want to let json expose real types
        return dict((str(k), str(v)) for k, v in bottle.request.json.items())
    return dict(bottle.request.params)


@bottle.get('/<version:re:[^/]+>/data/<table_name:re:[^/]+>')
@bottle.post('/<version:re:[^/]+>/data/<table_name:re:[^/]+>')
@USERS.auth_api_key(True)
@check_version
def data_table(_auth_user, table_name):
    table = tables.get_table(_auth_user, table_name)
    method = bottle.request.method.upper()
    if method == 'GET':
        return table.get_table(columns=parse_columns())
    elif method == 'POST':
        return table.post_table(*parse_params_files())
    else:
        bottle.abort(403)


@bottle.route('/<version:re:[^/]*>/data/<table_name:re:[^/]+>/<row:re:[^/]+>', 'PATCH')
@bottle.post('/<version:re:[^/]*>/data/<table_name:re:[^/]+>/<row:re:[^/]+>')
@bottle.delete('/<version:re:[^/]*>/data/<table_name:re:[^/]+>/<row:re:[^/]+>')
@bottle.get('/<version:re:[^/]*>/data/<table_name:re:[^/]+>/<row:re:[^/]+>')
@USERS.auth_api_key(True)
@check_version
def data_row(_auth_user, table_name, row):
    table = tables.get_table(_auth_user, table_name)
    method = bottle.request.method.upper()
    row = base64.urlsafe_b64decode(row)
    method = bottle.request.method.upper()
    if method == 'GET':
        return table.get_row(row, parse_columns())
    elif method == 'PATCH':
        return table.patch_row(row, *parse_params_files())
    elif method == 'POST':
        return table.post_row(row, *parse_params_files())
    elif method == 'DELETE':
        return table.delete_row(row)
    else:
        bottle.abort(403)


@bottle.delete('/<version:re:[^/]*>/data/<table_name:re:[^/]+>/<row:re:[^/]+>/<column:re:[^/]+>')
@USERS.auth_api_key(True)
@check_version
def data_column(_auth_user, table_name, row, column):
    table = tables.get_table(_auth_user, table_name)
    row = base64.urlsafe_b64decode(row)
    column = base64.urlsafe_b64decode(column)
    return table.delete_column(row, column)


@bottle.route('/<version:re:[^/]*>/slice/<table_name:re:[^/]+>/<start_row:re:[^/]+>/<stop_row:re:[^/]+>', 'PATCH')
@bottle.post('/<version:re:[^/]*>/slice/<table_name:re:[^/]+>/<start_row:re:[^/]+>/<stop_row:re:[^/]+>')
@bottle.delete('/<version:re:[^/]*>/slice/<table_name:re:[^/]+>/<start_row:re:[^/]+>/<stop_row:re:[^/]+>')
@bottle.get('/<version:re:[^/]*>/slice/<table_name:re:[^/]+>/<start_row:re:[^/]+>/<stop_row:re:[^/]+>')
@USERS.auth_api_key(True)
@check_version
def data_slice(_auth_user, table_name, start_row, stop_row):
    table = tables.get_table(_auth_user, table_name)
    method = bottle.request.method.upper()
    start_row = base64.urlsafe_b64decode(start_row)
    stop_row = base64.urlsafe_b64decode(stop_row)
    if method == 'GET':
        return table.get_slice(start_row, stop_row, parse_columns(), *parse_params_files())
    elif method == 'PATCH':
        return table.patch_slice(start_row, stop_row, *parse_params_files())
    elif method == 'DELETE':
        return table.delete_slice(start_row, stop_row)
    elif method == 'POST':
        return table.post_slice(start_row, stop_row, *parse_params_files())
    else:
        bottle.abort(403)


@bottle.get('/static/<name:re:[^/]+>')
def static(name):
    try:
        # Set far future expiration for static images (glyphs and icons)
        if name.endswith('.png') or name.endswith('.ico'):
            bottle.response.headers['Expires'] = 'Sat, 05 Sep 2026 00:00:00 GMT'
        bottle.response.headers['Cache-Control'] = 'public, max-age=3600, must-revalidate'
        return bottle.static_file(name, 'static/')
    except KeyError:
        bottle.abort(404)


@bottle.get('/')
def index():
    try:
        bottle.response.headers['Cache-Control'] = 'public, max-age=3600, must-revalidate'
        return bottle.static_file('app.html', 'static/')
    except KeyError:
        bottle.abort(404)


@bottle.get('/robots.txt')
def robots():
    return '''User-agent: *
Disallow: /'''


@bottle.post('/<version:re:[^/]*>/auth/email')
@check_version
@USERS.auth_login_key(True)
def auth_email(_auth_user):
    params = parse_params()
    try:
        USERS.email_api_key(_auth_user, ttl=params.get('ttl'))
    except UnknownUser:
        bottle.abort(401)
    return {}


@bottle.post('/<version:re:[^/]*>/auth/yubikey')
@check_version
@USERS.auth_login_key(True)
def auth_yubikey(_auth_user):
    params = parse_params()
    try:
        email = YUBIKEY.verify(params['otp'])
    except UnknownUser:
        bottle.abort(401)
    if not email or email != _auth_user.email:
        bottle.abort(401)
    return {'apiKey': _auth_user.create_api_key(ttl=params.get('ttl'))}


@bottle.get('/<version:re:[^/]*>/annotation/<task:re:[^/]*>/index.html')
@check_version
def annotate_index(task):
    try:
        return JOBS.get_annotation_manager(task, data_connection=None).index
    except (KeyError, jobs.NotFoundException):
        bottle.abort(404)
        

@bottle.get('/<version:re:[^/]*>/annotation/<task:re:[^/]*>/static/:file_name')
@check_version
def annotation_static(task, file_name):
    try:
        JOBS.get_annotation_manager(task, data_connection=None)
    except (KeyError, jobs.NotFoundException):
        bottle.abort(404)
    root = mturk_vision.__path__[0] + '/static'
    return bottle.static_file(file_name, root)


@bottle.get('/<version:re:[^/]*>/annotation/<task:re:[^/]*>/user.js')
@check_version
def annotation_user(task):
    try:
        return JOBS.get_annotation_manager(task, data_connection=None).user(bottle.request)
    except (KeyError, jobs.NotFoundException):
        bottle.abort(404)


@bottle.get('/<version:re:[^/]*>/annotation/<task:re:[^/]*>/config.js')
@check_version
def annotation_config(task):
    try:
        return JOBS.get_annotation_manager(task, data_connection=None).config
    except (KeyError, jobs.NotFoundException):
        bottle.abort(404)


@bottle.get('/<version:re:[^/]*>/annotation/<task:re:[^/]*>/:user_id/data.js')
@check_version
def annotation_data(task, user_id):
    with thrift_lock() as thrift:
        try:
            return JOBS.get_annotation_manager(task, data_connection=thrift).make_data(user_id)
        except (KeyError, jobs.NotFoundException):
            bottle.abort(404)


@bottle.get('/<version:re:[^/]*>/annotation/<task:re:[^/]*>/image/:image_key')
@check_version
def annotation_image_get(task, image_key):
    with thrift_lock() as thrift:
        try:
            data_key = image_key.rsplit('.', 1)[0]
            cur_data = JOBS.get_annotation_manager(task, data_connection=thrift).read_data(data_key)
        except (KeyError, jobs.NotFoundException):
            bottle.abort(404)
    bottle.response.content_type = "image/jpeg"
    return cur_data


@bottle.get('/<version:re:[^/]*>/annotation/<task:re:[^/]*>/data/:data_key')
@check_version
def annotation_data_get(task, data_key):
    with thrift_lock() as thrift:
        try:
            cur_data = JOBS.get_annotation_manager(task, data_connection=thrift).read_data(data_key)
        except (KeyError, jobs.NotFoundException):
            bottle.abort(404)
    return cur_data


@bottle.post('/<version:re:[^/]*>/annotation/<task:re:[^/]*>/result')
@check_version
def annotation_result(task):
    with thrift_lock() as thrift:
        try:
            return JOBS.get_annotation_manager(task, data_connection=thrift).result(**bottle.request.json)
        except (KeyError, jobs.NotFoundException):
            bottle.abort(404)


@bottle.error(500)
@bottle.error(400)
@bottle.error(401)
@bottle.error(403)
@bottle.error(404)
def error_handler(error):
    return error.body

if __name__ == '__main__':
    import gevent.pywsgi
    SERVER = gevent.pywsgi.WSGIServer(('0.0.0.0', ARGS.port), bottle.app(),
                                      spawn=MAX_CONNECTIONS)

    def reloader():
        import gevent_inotifyx as inotifyx
        fd = inotifyx.init()
        # NOTE: .git/logs/HEAD is the last thing updated after a git pull/merge
        inotifyx.add_watch(fd, '../.git/logs/HEAD', inotifyx.IN_MODIFY)
        inotifyx.add_watch(fd, '.reloader', inotifyx.IN_MODIFY | inotifyx.IN_ATTRIB)
        inotifyx.get_events(fd)
        logging.warn('Shutting down due to new update')
        SERVER.stop_accepting()
        logging.warn('Free Count[%d] (will kill outstanding processes in 120 sec.)' % SERVER.pool.free_count())
        SERVER.pool.join(timeout=120)
        SERVER.close()
        logging.warn('Shut down successful')

    def refresh_hadoop_jobs():
        while 1:
            try:
                JOBS.update_hadoop_jobs(ARGS.hadoop_jobtracker)
            except:
                if ARGS.raven:
                    RAVEN.captureException()
            gevent.sleep(5.)
    if ARGS.reloader:
        gevent.spawn(reloader)
    if ARGS.hadoop_jobtracker and ARGS.database.endswith('hadoop'):
        gevent.spawn(refresh_hadoop_jobs)

    def THRIFT_CONSTRUCTOR():
        return databases.factory(ARGS.database, ARGS.local, JOBS,
                                 thrift_server=ARGS.thrift_server, thrift_port=ARGS.thrift_port,
                                 redis_host=ARGS.redis_host, redis_port=ARGS.redis_port)
    for x in range(16):
        THRIFT_POOL.put(THRIFT_CONSTRUCTOR())
    SERVER.serve_forever()
