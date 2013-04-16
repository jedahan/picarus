function PicarusClient(email, apiKey, server) {
    if (_.isUndefined(server))
        server = 'https://api.picar.us';
    this.email = email;
    this.apiKey = apiKey;
    this.server = server;
    this.version = 'a1';

    this.get = function (path, data, success, fail) {
        path = [this.server, this.version].concat(_.map(path, encodeURIComponent)).join('/');
        $.ajax(path, {data: data, success: success}).fail(fail);
    };

    this._ajax = function (path, data, success, fail, type) {
        path = [this.server, this.version].concat(_.map(path, encodeURIComponent)).join('/');
        var formData = new FormData();
        _.each(data, function (v, k) {
            formData.append(k, v);
        });
        $.ajax(path, {type: type, data: formData, success: success, contentType: false, processData: false}).fail(fail);
    };
    
    this.post = function (path, data, success, fail) {
        this._ajax(path, data, success, fail, 'POST');
    };

    this.patch = function (path, data, success, fail) {
        this._ajax(path, data, success, fail, 'PATCH');
    };

    this.del = function (path, data, success, fail) {
        this._ajax(path, data, success, fail, 'DELETE');
    };

    this.get_table = function (table, args) {
        //args: success, fail, columns
        this._args_defaults(args);
        if (_.has(args, 'columns'))
            args.data.columns = _.map(args.columns, function(x) {return base64.encode(x)}).join(',');
        this.get(['data', table], args.data, this._wrap_decode_lod(args.success), args.fail);
    };
    this.post_table = function (table, args) {
        //args: success, fail, data
        this._args_defaults(args);
        this.post(['data', table], this.encdict(args.data), this._wrap_decode_values(args.success), args.fail);
    };
    this.patch_row = function (table, row, args) {
        //args: success, fail, data
        this._args_defaults(args);
        this.patch(['data', table, base64.encode(row)], this.encdict(args.data), this._wrap_decode_values(args.success), args.fail);
    };
    this.encdict = function (d) {
        return _.object(_.map(d, function (v, k) {
            if (!_.isObject(v)) // NOTE(brandyn): The reason is that files are "object" type
                v = base64.encode(v);
            return [base64.encode(k), v];
        }));
    };
    this.get_row = function (table, row, args) {
        //args: success, fail, columns
        this._args_defaults(args);
        if (_.has(args, 'columns'))
            args.data.columns = _.map(args.columns, function(x) {return base64.encode(x)}).join(',');
        this.get(['data', table, base64.encode(row)], args.data, this._wrap_decode_dict(args.success), args.fail);
    };
    this.get_slice = function (table, startRow, stopRow, args) {
        //args: success, fail, columns, data
        this._args_defaults(args);
        if (_.has(args, 'columns'))
            args.data.columns = _.map(args.columns, function(x) {return base64.encode(x)}).join(',');
        this.get(['slice', table, base64.encode(startRow), base64.encode(stopRow)], args.data, this._wrap_decode_lod(args.success), args.fail);
    };
    this._args_defaults = function (args) {
        if (!_.has(args, 'success'))
            args.success = function () {};
        if (!_.has(args, 'fail'))
            args.fail = function () {};
        if (!_.has(args, 'data'))
            args.data = {};
    };
    this._wrap_decode_lod = function(f) {
        return function(msg, text_status, xhr) {
            f(_.map(JSON.parse(xhr.responseText), function (x) {
                var row = base64.decode(x.row);
                var columns = _.object(_.map(_.omit(x, 'row'), function (v, k) {
                    return [base64.decode(k), base64.decode(v)];
                }));
                return [row, columns];
            }));
        };
    };
    this._wrap_decode_dict = function(f) {
        return function(msg, text_status, xhr) {
            f(_.object(_.map(JSON.parse(xhr.responseText), function (v, k) {
                    return [base64.decode(k), base64.decode(v)];
            })));
        };
    };
    this._wrap_decode_values = function(f) {
        return function(msg, text_status, xhr) {
            f(_.object(_.map(JSON.parse(xhr.responseText), function (v, k) {
                    return [k, base64.decode(v)];
            })));
        };
    };
    this.test = function () {
        this.get_table('parameters', {success: function (x) {console.log('Set debug_a'); debug_a=x}});
        this.get_table('models', {success: function (x) {console.log('Set debug_b'); debug_b=x}, columns: ['meta:']});
        this.get_slice('images', 'sun397:', 'sun397;', {success: function (x) {console.log('Set debug_c'); debug_c=x}, columns: ['meta:']});
        function test_patch_row(row) {
            this.patch_row('images', row, {success: function (x) {console.log('Set debug_f'); debug_f=x;test_get_row(row)}, data: {'meta:class_0': 'test_data2'}});
        }
        function test_get_row(row) {
            this.get_row('images', row, {success: function (x) {console.log('Set debug_d'); debug_d=x}, columns: ['meta:']});
        }
        test_get_row = _.bind(test_get_row, this);
        test_patch_row = _.bind(test_patch_row, this);
        this.post_table('images', {success: function (x) {console.log('Set debug_e');debug_e=x;test_patch_row(x.row);}, data: {'meta:class': 'test_data'}});
    };
}
/*

class PicarusClient(object):

    def __init__(self, email, api_key, server="https://api.picar.us"):
        self.email = email
        self.api_key = api_key
        self.server = server
        self.version = 'a1'

    def _check_status(self, response):
        if response.status_code != 200:
            raise RuntimeError('picarus_api: returned [%d]' % (response.status_code))
        return json.loads(response.content)

    def _decode_lod(self, lod):
        row_columns = []
        for x in lod:
            row = self.dec(x['row'])
            columns = {self.dec(x): self.dec(y) for x, y in x.items() if x != 'row'}
            row_columns.append((row, columns))
        return row_columns

    def _decode_dict(self, d):
        return {self.dec(x): self.dec(y) for x, y in d.items()}

    # raw

    def get(self, path, data=None):
        path = '/'.join(map(urllib.quote_plus, path))
        r = requests.get('%s/%s/%s' % (self.server, self.version, path), auth=(self.email, self.api_key), params=data)
        return self._check_status(r)

    def post(self, path, data=None, files=None):
        path = '/'.join(map(urllib.quote_plus, path))
        r = requests.post('%s/%s/%s' % (self.server, self.version, path), auth=(self.email, self.api_key), data=data, files=files)
        return self._check_status(r)

    def delete(self, path, data=None):
        path = '/'.join(map(urllib.quote_plus, path))
        r = requests.delete('%s/%s/%s' % (self.server, self.version, path), auth=(self.email, self.api_key), data=data)
        return self._check_status(r)

    def patch(self, path, data=None, files=None):
        path = '/'.join(map(urllib.quote_plus, path))
        r = requests.patch('%s/%s/%s' % (self.server, self.version, path), auth=(self.email, self.api_key), data=data, files=files)
        return self._check_status(r)

    def _encode_columns(self, columns):
        data = {}
        if columns is not None:
            data['columns'] = ','.join(map(self.enc, columns))
        return data

    # /data/:table

    def get_table(self, table, columns=None):
        return self._decode_lod(self.get(('data', table), data=self._encode_columns(columns)))

    def post_table(self, table, data=None, files=None):
        return self.decvalues(self.post(('data', table), data=self.encdict(data), files=self.enckeys(files)))

    # /data/:table/:row

    def get_row(self, table, row, columns=None):
        return self.decdict(self.get(('data', table, self.enc(row)), data=self._encode_columns(columns)))

    def post_row(self, table, row, data=None, files=None):
        return self.post(('data', table, self.enc(row)), data=data, files=files)

    def delete_row(self, table, row):
        return self.delete(('data', table, self.enc(row)))

    def patch_row(self, table, row, data=None, files=None):
        return self.patch(('data', table, self.enc(row)), data=self.encdict(data), files=self.enckeys(files))

    # /slice/:table/:start_row/:stop_row

    def get_slice(self, table, start_row, stop_row, columns=None, data=None):
        column_data = self._encode_columns(columns)
        if data is not None:
            column_data.update(data)
        return self._decode_lod(self.get(('slice', table, self.enc(start_row), self.enc(stop_row)), data=column_data))

    def post_slice(self, table, start_row, stop_row, action, data=None):
        if data is None:
            data = {}
        data['action'] = action
        return self.post(('slice', table, self.enc(start_row), self.enc(stop_row)), data=data)

    def patch_slice(self, table, start_row, stop_row, data=None):
        return self.patch(('slice', table, self.enc(start_row), self.enc(stop_row)), data=self.encdict(data))

    def scanner(self, table, start_row, stop_row, columns=None):
        max_rows_iter = 10000
        data = {}
        data['maxRows'] = max_rows_iter
        while True:
            row_columns = self.get_slice(table, start_row, stop_row, columns=columns, data=data)
            if not row_columns:
                break
            for row, columns in row_columns:
                yield row, columns
            start_row = row
            data['excludeStart'] = '1'

    def enc(self, x):
        return base64.b64encode(str(x))

    def dec(self, x):
        return base64.b64decode(str(x))

    def encdict(self, d):
        return {self.enc(x): self.enc(y) for x, y in d.items()}

    def decdict(self, d):
        return {self.dec(x): self.dec(y) for x, y in d.items()}

    def enckeys(self, d):
        return {self.enc(x): y for x, y in d.items()}

    def decvalues(self, d):
        return {x: self.dec(y) for x, y in d.items()}

*/

function prefix_to_stop_row(prefix) {
    // TODO: need to fix wrap around if last char is "255"
    return prefix.slice(0, -1) + String.fromCharCode(prefix.slice(-1).charCodeAt(0) + 1);
}

function picarus_api(url, method, args) {
    /* args: data, email, auth, success, fail */
    if (typeof args == 'undefined' ) args = {};
    var success;
    if (args.hasOwnProperty('success')) success = function(msg, text_status, xhr) {args.success(xhr)};

    function param_encode(data) {
        return _.map(data, function (v, k) {
            return k + '=' + v;
        }).join('&');
    }

    var data = new FormData();
    if (method === 'GET') {
        data = undefined;
        if (args.hasOwnProperty('data')) {
            url += '?' + param_encode(args.data);
        }
    } else {
        if (args.hasOwnProperty('data')) {
            jQuery.each(args.data, function(k, v) {
                data.append(k, v);
            });
        }
    }
    var options = {
        type: method,
        url: url,
        contentType: false,
        processData: false, // needed for POSTing of binary data
        data: data,
        success: success
    }
        
    if (args.hasOwnProperty('email') && args.hasOwnProperty('auth')) {
        options.beforeSend = function(xhr) {
            xhr.setRequestHeader("Authorization", "Basic " + base64.encode(args.email + ":" + args.auth));
        };
    }
    var request = $.ajax(options);
    if (args.hasOwnProperty('fail')) request.fail(function(xhr, text_status) {args.fail(xhr)});
}

function encode_id(data) {
    return base64.encode(data);
}

function decode_id(data) {
    return base64.decode(data);
}

function picarus_api_row(table, row, method, args) {
    picarus_api("/a1/data/" + table + "/" + row, method, args);
}

function picarus_api_upload(table, args) {
    picarus_api("/a1/data/" + table, "POST", args);
}

function picarus_api_test(url, method, args) {
    /* args: data, email, auth, div, success, fail */
    if (typeof args == 'undefined' ) args = {};
    function clear_error() {
    }
    function report_result(xhr, label_type) {
        if (args.hasOwnProperty('div')) {
            args.div.html('<span class="label ' + label_type +'">' + xhr.status + '</span><p><pre>' + args.data  +  '</pre></p><p><pre>' + xhr.getAllResponseHeaders() + '</pre></p><p><pre>' + xhr.responseText + '</pre></p>');
        }
    }
    function before_send(xhr) {
        clear_error();
        if (args.hasOwnProperty('div')) {
            args.div.html('<span class="label warning">' + 'Running' + '</span>');
        }
    }
    function success(xhr) {
        report_result(xhr, "label-success");
        if (args.hasOwnProperty('success')) {
            args.success(xhr);
        }
    }
    function fail(xhr) {
        clear_error();
        report_result(xhr, "label-important");
        if (args.hasOwnProperty('fail')) {
            args.fail(xhr);
        }
    }
    picarus_api(url, method, _.extend({}, args, {success: success, fail: fail, before_send: before_send}));
}

function class_key(classes, div) {
    div.html('');
    cur_classes = classes;
    classes = _.map(classes, function (value, class_name) {
        value.name = class_name;
        return value;
    });
    classes = _.sortBy(classes, 'mask_num');
    _.each(classes, function (value) {
        div.append($('<span>', {style: 'color:rgb(' + value['color'][0] + ','+ value['color'][1] + ',' + value['color'][2] + ')'}).html('&#x25A0;'));
        div.append(' (' + value['mask_num'] + ') ' + value['name']);
        div.append('<br>');
    })
}

function picarus_api_data_scanner(table, startRow, stopRow, columns, params) {
    // params: success, done, maxRows, maxRowsIter, first, filter, resume
    if (typeof params.maxRows == "undefined") {
        params.maxRows = Infinity;
    }
    if (typeof params.maxRowsIter == "undefined") {
        params.maxRowsIter = Math.min(10000, params.maxRows);
    }
    if (typeof params.maxBytes == "undefined") {
        params.maxBytes = 1048576;
    }
    function param_encode(dd) {
        return _.map(dd, function (v) {
            return v.join('=');
        }).join('&');
    }
    // Removed encode_id(x) below, should add it back after refactor that exposes unencoded data only
    var column_suffix =  [['columns', _.map(columns, function (x) {return x}).join(',')]];
    var lastRow = undefined;
    var numRows = 0;
    if (typeof params.filter != "undefined") {
        column_suffix = column_suffix.concat([['filter', escape(params.filter)]]);
    }
    function map_success(xhr) {
        var data = JSON.parse(xhr.responseText);
        var isdone = true;
        params.maxRows -= data.length;
        if (params.maxRows < 0) {
            // Truncates any excess rows we may have gotten
            data = data.slice(0, params.maxRows);
        }
        if (numRows == 0 && data.length && typeof params.first != "undefined") {
            var firstRow = _.first(data);
            params.first(firstRow.row, _.omit(firstRow, 'row'));
        }
        if (typeof params.success != "undefined") {
            _.each(data, function (v) {
                lastRow = v.row;
                params.success(v.row, _.omit(v, 'row'));
            });
        }
        numRows += data.length;
        console.log(numRows);
        // If there is more data left to get, and we want more data
        // It's possible that this will make 1 extra call at the end that returns nothing,
        // but there are several trade-offs and that is the simplest implementation that doesn't
        // encode extra parameters, modify status codes (nonstandard), output fixed rows only, etc.
        if (data.length && params.maxRows > 0) {
            isdone = false;
            function next_call() {
                var dd = _.pairs({maxRows: String(params.maxRowsIter), excludeStart: "1"}).concat(column_suffix);
                var url = "/a1/slice/" + table + "/" + _.last(data).row + "/" + stopRow + '?' + param_encode(dd);
                picarus_api(url, "GET", {success: map_success});
            }
            // This allows for pagination instead of immediately requesting the next chunk
            if (typeof params.resume == "undefined") {
                next_call();
            } else {
                params.resume(next_call);
            }
        }
        if (isdone && typeof params.done != "undefined") {
            params.done({lastRow: lastRow, numRows: numRows});
        }
    }
    var dd = _.pairs({maxRows: String(params.maxRowsIter)}).concat(column_suffix);
    picarus_api("/a1/slice/" + table +  "/" + startRow + "/" + stopRow + '?' + param_encode(dd), "GET", {success: map_success});
}


function picarus_api_delete_rows(rows, params) {
    function action(row, s) {
        picarus_api_row('images', row, "DELETE", {success: s});
    }
    picarus_api_row_action(rows, action, params);
}

function picarus_api_modify_rows(rows, column, value, params) {
    function action(row, s) {
        var data = {};
        data[encode_id(column)] = base64.encode(value);
        picarus_api_row('images', row, "PATCH", {success: s, data: data});
    }
    picarus_api_row_action(rows, action, params);
}


function picarus_api_row_action(rows, action, params) {
    var maxRowsIter = 20;
    var rowsLeft = rows.length;
    var origRows = rows.length;
    if (_.isUndefined(params))
        params = {};
    if (!_.isUndefined(params.maxRowsIter))
        maxRowsIter = params.maxRowsIter;
    if (_.isUndefined(params.update))
        params.update = function () {};
    if (_.isUndefined(params.done))
        params.done = function () {};
    if (!rowsLeft)
        params.done();
    function success() {
        rowsLeft -= 1;
        params.update(1 - rowsLeft / origRows);
        if (!rowsLeft)
            params.done();
    }
    function work(s) {
        var row = rows.pop();
        if (_.isUndefined(row))
            return;
        action(row, s);
    }
    _.each(_.range(maxRowsIter), function () {
        work(function () { 
                 success();
                 while (rows.length)
                     work(success);
             });
    });
}