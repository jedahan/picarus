function login_get(func) {
    var otp = $('#otp');
    var apiKey = $('#apiKey');
    var modal = $('#authModal');
    var emailKeys = $('#emailKeys');
    emailKeys.click(function () {
        var email = $('#email').val();
        var loginKey = $('#loginKey').val();
        picarus_api("/a1/auth/email", "POST", {email: email, auth: loginKey});
    });
    if (typeof EMAIL_AUTH === 'undefined') {
        function get_auth() {
            function success(xhr) {
                use_api(JSON.parse(xhr.responseText).apiKey);
            }
            function fail() {
                $('#secondFactorAuth').addClass('error');
            }
            var otp_val = otp.val();
            var email = $('#email').val();
            var loginKey = $('#loginKey').val();
            picarus_api("/a1/auth/yubikey", "POST", {data: {otp: otp_val}, success: success, email: email, auth: loginKey, fail: fail});
        }
        function get_api() {
            var email = $('#email').val();
            var apiKey = $('#apiKey').val();
            function success(xhr) {
                use_api(apiKey);
            }
            function fail() {
                $('#secondFactorAuth').addClass('error');
            }
            $('#secondFactorAuth').addClass('info');
            $('#secondFactorAuth').removeClass('error');
            picarus_api("/a1/data/users/" + encode_id(email), "GET", {success: success, email: email, auth: apiKey, fail: fail});
        }
        function use_api(apiKey) {
            var email = $('#email').val();
            var loginKey = $('#loginKey').val();
            $('#secondFactorAuth').removeClass('error');
            $.cookie('email', email, {secure: true});
            $.cookie('loginKey', loginKey, {secure: true});
            EMAIL_AUTH = {auth: apiKey, email: email};
            $('#otp').unbind();
            $('#apiKey').unbind('keypress');
            func(EMAIL_AUTH);
            modal.modal('hide');
        }
        function enable_inputs() {
            var email = $('#email').val();
            var loginKey = $('#loginKey').val();
            if (email.length && loginKey.length) {
                otp.removeAttr("disabled");
                apiKey.removeAttr("disabled");
                emailKeys.removeAttr("disabled");
            }
        }
        $('#email').val($.cookie('email'));
        $('#loginKey').val($.cookie('loginKey'));
        enable_inputs();
        $('#email').keypress(enable_inputs);
        $('#email').on('paste', function () {_.defer(enable_inputs)});
        $('#loginKey').keypress(enable_inputs);
        $('#loginKey').on('paste', function () {_.defer(enable_inputs)});
        otp.keypress(_.debounce(get_auth, 100));
        otp.on('paste', function () {_.defer(get_auth)});
        apiKey.keypress(_.debounce(get_api, 100));
        apiKey.on('paste', function () {_.defer(get_api)});
        modal.modal('show');
        modal.off('shown');
        modal.on('shown', function () {otp.focus()});
    } else {
        func(EMAIL_AUTH);
    }
}

function google_visualization_load(callback) {
    google.load("visualization", "1", {packages:["corechart"], callback: callback});
}

function add_hint(el, text) {
    el.wrap($('<span>').attr('class', 'hint hint--bottom').attr('data-hint', text));
}
function random_bytes(num) {
    return _.map(_.range(10), function () {
        return String.fromCharCode(_.random(255));
    }).join('');
}

function imageThumbnail(row, id) {
    var imageColumn = encode_id('thum:image_150sq');
    function success(xhr) {
        var columns = JSON.parse(xhr.responseText);
        $('#' + id).attr('src', 'data:image/jpeg;base64,' + columns[imageColumn]).attr('title', row)
    }
    picarus_api("/a1/data/images/" + row, "GET", {success: success, data: {columns: imageColumn}});
}

function button_confirm_click(button, fun) {
    button.unbind();
    button.click(function (data) {
        var button = $(data.target);
        button.unbind();
        button.addClass('btn-danger');
        button.click(fun);
    });
}
function button_confirm_click_reset(button) {
    button.removeClass('btn-danger');
    button.unbind();
}

function progressModal() {
    $('#progressModal').modal('show');
    function update(pct) {
        $('#progress').css('width', (100 * pct + '%'));
    }
    function done() {
        $('#progressModal').modal('hide');
    }
    return {done: done, update: update};
}

function alert_running() {
    $('#results').html('<div class="alert alert-info"><strong>Running!</strong> Job is running, please wait...</div>');
}

function alert_done() {
    $('#results').html('<div class="alert alert-success"><strong>Done!</strong> Job is done.</div>');
}

function alert_running_wrap(el) {
    return function () {
        el.html('<div class="alert alert-info"><strong>Running!</strong> Job is running, please wait...</div>');
    }
}

function alert_success_wrap(el) {
    return function () {
        el.html('<div class="alert alert-success"><strong>Done!</strong> Job is done.</div>');
    }
}

function alert_fail_wrap(el) {
    return function () {
        el.html('<div class="alert alert-error"><strong>Error!</strong> Job failed!</div>');
    }
}

function wrap_hints() {
    $('[hint]').each(function (x) {
        $(this).wrap($('<span>').attr('class', 'hint hint--bottom').attr('data-hint', $(this).attr('hint')));
    });
}

function button_running() {
    $('#runButton').button('loading');
}

function button_reset() {
    $('#runButton').button('reset');
}

function button_error() {
    $('#runButton').button('error');
}

function model_dropdown(args) {
    var columns_model = ['meta:'];
    var models = new PicarusRows([], {'table': 'models', columns: columns_model});
    if (typeof args.change === 'undefined') {
        args.change = function () {};
    }
    var AppView = Backbone.View.extend({
        el: $('#container'),
        initialize: function() {
            _.bindAll(this, 'render');
            _.bindAll(this, 'renderDrop');
            this.$el.bind('reset', this.renderDrop);
            this.$el.bind('change', this.renderDrop);
            this.collection.bind('reset', this.render);
            this.collection.bind('change', this.render);
        },
        renderDrop: args.change,
        modelFilter: args.modelFilter,
        render: function() {
            n = this.$el;
            this.$el.empty();
            var select_template = "{{#models}}<option value='{{row}}'>{{{text}}}</option>{{/models}};" // text is escaped already
            var models_filt = _.map(models.filter(this.modelFilter), function (data) {return {row: data.escape('row'), text: data.pescape('meta:tags') + ' ' + data.pescape('meta:name')}});
            models_filt.sort(function (x, y) {return Number(x.text > y.text) - Number(x.text < y.text)});
            this.$el.append(Mustache.render(select_template, {models: models_filt}));
            this.renderDrop();
        }
    });
    av = new AppView({collection: models, el: args.el});
    models.fetch();
    return models;
}

function rows_dropdown(rows, args) {
    if (_.isUndefined(args.change)) {
        args.change = function () {};
    }
    if (_.isUndefined(args.filter)) {
        args.filter = function () {return true};
    }
    if (_.isUndefined(args.text)) {
        args.text = function (x) {return x.escape('row')};
    }
    var AppView = Backbone.View.extend({
        el: $('#container'),
        initialize: function() {
            _.bindAll(this, 'render');
            _.bindAll(this, 'renderDrop');
            this.$el.bind('reset', this.renderDrop);
            this.$el.bind('change', this.renderDrop);
            this.collection.bind('reset', this.render);
            this.collection.bind('change', this.render);
        },
        renderDrop: args.change,
        render: function() {
            n = this.$el;
            this.$el.empty();
            var select_template = "{{#models}}<option value='{{row}}'>{{text}}</option>{{/models}};"
            var models_filt = _.map(rows.filter(args.filter), function (data) {return {row: data.escape('row'), text: args.text(data)}});
            models_filt.sort(function (x, y) {return Number(x.text > y.text) - Number(x.text < y.text)});
            this.$el.append(Mustache.render(select_template, {models: models_filt}));
            this.renderDrop();
        }
    });
    av = new AppView({collection: rows, el: args.el});
    rows.fetch();
}


function project_selector(projectsDrop) {
    var AppView = Backbone.View.extend({
        initialize: function() {
            _.bindAll(this, 'render');
            this.model.bind('reset', this.render);
            this.model.bind('change', this.render);
        },
        render: function() {
            this.$el.empty();
            var projects = _.keys(this.model.pescapejs('image_projects'));
            projects.sort(function (x, y) {return Number(x > y) - Number(x < y)});
            var select_template = "{{#projects}}<option value='{{.}}'>{{.}}</option>{{/projects}};"
            this.$el.append(Mustache.render(select_template, {projects: projects}));
            this.renderDrop();
        }
    });
    var auth = login_get(function (email_auth) {
        user = new PicarusUser({row: encode_id(email_auth.email)});
        new AppView({model: user, el: projectsDrop});
        user.fetch();
    });
}

function row_selector(prefixDrop, startRow, stopRow) {
    var AppView = Backbone.View.extend({
        initialize: function() {
            _.bindAll(this, 'render');
            this.model.bind('reset', this.render);
            this.model.bind('change', this.render);
        },
        events: {'change': 'renderDrop'},
        renderDrop: function () {
            var prefix = prefixDrop.children().filter('option:selected').val();
            if (typeof startRow !== 'undefined')
                startRow.val(prefix);
            // TODO: Assumes that prefix is not empty and that the last character is not 0xff (it would overflow)
            if (typeof stopRow !== 'undefined')
                stopRow.val(prefix_to_stop_row(prefix));
        },
        render: function() {
            this.$el.empty();
            // TODO: Check permissions and accept perissions as argument
            var prefixes = _.keys(this.model.pescapejs('image_prefixes'));
            prefixes.sort(function (x, y) {return Number(x > y) - Number(x < y)});
            var select_template = "{{#prefixes}}<option value='{{.}}'>{{.}}</option>{{/prefixes}};"
            this.$el.append(Mustache.render(select_template, {prefixes: prefixes}));
            this.renderDrop();
        }
    });
    var auth = login_get(function (email_auth) {
        user = new PicarusUser({row: encode_id(email_auth.email)});
        new AppView({model: user, el: prefixDrop});
        user.fetch();
    });
}

function slices_selector() {
    var prefixDrop = $('#slicesSelectorPrefixDrop'), startRow = $('#slicesSelectorStartRow'), stopRow = $('#slicesSelectorStopRow');
    var addButton = $('#slicesSelectorAddButton'), clearButton = $('#slicesSelectorClearButton'), slicesText = $('#slicesSelectorSlices');
    if (!prefixDrop.size())  // Skip if not visible
        return;
    var AppView = Backbone.View.extend({
        initialize: function() {
            _.bindAll(this, 'render');
            this.model.bind('reset', this.render);
            this.model.bind('change', this.render);
        },
        events: {'change': 'renderDrop'},
        renderDrop: function () {
            var prefix = prefixDrop.children().filter('option:selected').val();
            if (typeof startRow !== 'undefined')
                startRow.val(prefix);
            // TODO: Assumes that prefix is not empty and that the last character is not 0xff (it would overflow)
            if (typeof stopRow !== 'undefined')
                stopRow.val(prefix_to_stop_row(prefix));
        },
        render: function() {
            this.$el.empty();
            // TODO: Check permissions and accept perissions as argument
            var prefixes = _.keys(this.model.pescapejs('image_prefixes'));
            prefixes.sort(function (x, y) {return Number(x > y) - Number(x < y)});
            var select_template = "{{#prefixes}}<option value='{{.}}'>{{.}}</option>{{/prefixes}};"
            this.$el.append(Mustache.render(select_template, {prefixes: prefixes}));
            this.renderDrop();
        }
    });
    addButton.click(function () {
        slicesText.append($('<option>').text(startRow.val() + '/' + stopRow.val()).attr('value', encode_id(unescape(startRow.val())) + '/' + encode_id(unescape(stopRow.val()))));
    });
    clearButton.click(function () {
        slicesText.html('');
    });
    var auth = login_get(function (email_auth) {
        user = new PicarusUser({row: encode_id(email_auth.email)});
        new AppView({model: user, el: prefixDrop});
        user.fetch();
    });
}

function slices_selector_get(split) {
    var out = _.map($('#slicesSelectorSlices').children(), function (x) {return $(x).attr('value')});
    if (split)
        return _.map(out, function (x) {
            return x.split('/')
        });
    return out;
}

function app_main() {
    // Setup models
    function param_encode(dd) {
        return _.map(dd, function (v) {
            return v.join('=');
        }).join('&');
    }
    PicarusRow = Backbone.Model.extend({
        idAttribute: "row",
        initialize: function(models, options) {
            this.table = options.table;
            if (_.isArray(options.columns)) {
                this.params = '?columns=' + _.map(options.columns, function (x) {return encode_id(x)}).join(',');
            } else {
                this.params = '';
            }
        },
        pescape: function (x) {
            return _.escape(base64.decode(this.escape(encode_id(x))));
        },
        pescaperow: function () {
            return _.escape(base64.decode(this.escape('row')));
        },
        pescapejs: function (x) {
            var val = this.get(encode_id(x));
            if (_.isUndefined(val))
                return;
            return JSON.parse(base64.decode(val));
        },
        psave: function (attributes, options) {
            return this.save(object_ub64_b64_enc(attributes), options);
        },
        get_table: function () {
            var table = this.table;
            if (_.isUndefined(table))
                table = this.collection.table;
            return table;
        },
        punset: function (column) {
            function s() {
                this.unset(column);
            }
            s = _.bind(s, this);
            picarus_api("/a1/data/" + this.get_table() + "/" + this.id + "/" + column, 'DELETE', {success: s});
        },
        url : function() {
            return '/a1/data/' + this.get_table() + '/' + this.id;
        }
    });

    PicarusRows = Backbone.Collection.extend({
        model : PicarusRow,
        initialize: function(models, options) {
            this.table = options.table;
            if (_.isArray(options.columns)) {
                this.params = '?columns=' + _.map(options.columns, function (x) {return encode_id(x)}).join(',');
            } else {
                this.params = '';
            }
        },
        pget: function(x) {
            return this.get(encode_id(x));
        },
        url : function() {
            return this.id ? '/a1/data/' + this.table + '/' + this.id : '/a1/data/' + this.table + this.params; 
        }
    });

    function deleteValueFunc(row, column) {
        if (column == 'row')
            return '';
        return Mustache.render('<a class="value_delete" style="padding-left: 5px" row="{{row}}" column="{{column}}">Delete</a>', {row: row, column: column});
    }
    function deleteRowFunc(row) {
        return Mustache.render('<button class="btn row_delete" type="submit" row="{{row}}"">Delete</button>', {row: row});
    }

    RowsView = Backbone.View.extend({
        initialize: function(options) {
            _.bindAll(this, 'render');
            this.collection.bind('reset', this.render);
            this.collection.bind('change', this.render);
            this.collection.bind('remove', this.render);
            this.collection.bind('destroy', this.render);
            this.extraColumns = [];
            this.postRender = function () {};
            this.deleteValues = false;
            this.deleteRows = false;
            if (!_.isUndefined(options.postRender))
                this.postRender = options.postRender;
            if (!_.isUndefined(options.extraColumns))
                this.extraColumns = options.extraColumns;
            if (options.deleteRows) {
                this.deleteRows = true;
                function delete_row(data) {
                    var row = data.target.getAttribute('row');
                    this.collection.get(row).destroy({wait: true});
                }
                delete_row = _.bind(delete_row, this);
                this.postRender = _.compose(this.postRender, function () {
                    button_confirm_click($('.row_delete'), delete_row);
                });
                this.extraColumns.push({header: "Delete", getFormatted: function() { return deleteRowFunc(this.escape('row'))}});
            }
            if (options.deleteValues) {
                this.deleteValues = true;
                function delete_value(data) {
                    var row = data.target.getAttribute('row');
                    var column = data.target.getAttribute('column');
                    this.collection.get(row).punset(column);
                }
                delete_value = _.bind(delete_value, this);
                this.postRender = _.compose(this.postRender, function () {
                    button_confirm_click($('.value_delete'), delete_value);
                });
            }
            if (options.columns) {
                this.columns = _.map(options.columns, function (x) {
                    if (x == 'row')
                        return x;
                    return encode_id(x);
                });
            }
        },
        render: function() {
            
            var columns = this.columns;
            if (_.isUndefined(columns))
                columns = _.uniq(_.flatten(_.map(this.collection.models, function (x) {
                    return _.keys(x.attributes);
                })));
            var deleteValueFuncLocal = function () {return ''};
            if (this.deleteValues)
                deleteValueFuncLocal = deleteValueFunc;
            var table_columns = _.map(columns, function (x) {
                if (x === 'row')
                    return {header: 'row', getFormatted: function() { return _.escape(this.get(x))}};
                outExtra = '';
                return {header: decode_id(x), getFormatted: function() {
                    var val = this.get(x);
                    if (_.isUndefined(val))
                        return '';
                    return _.escape(base64.decode(val)) + deleteValueFuncLocal(this.get('row'), x);
                }
                };
            }).concat(this.extraColumns);
            picarus_table = new Backbone.Table({
                collection: this.collection,
                columns: table_columns
            });
            if (this.collection.length) {
                this.$el.html(picarus_table.render().el);
                this.postRender();
            } else {
                this.$el.html('<div class="alert alert-info">Table Empty</div>');
            }
        }
    });

    PicarusUser = Backbone.Model.extend({ // TODO: Switch over to PicarusRow
        idAttribute: "row",
        defaults : {
        },
 
        url : function() {
            return this.id ? '/a1/data/users/' + this.id  : '/a1/data/users'; 
        },
        pescape: function (x) {
            return _.escape(base64.decode(this.escape(encode_id(x))));
        },
        pescapejs: function (x) {
            return JSON.parse(base64.decode(this.escape(encode_id(x))));
        }
    });
    PicarusUsers = Backbone.Collection.extend({
        model : PicarusUser,
        url : "/a1/data/users"
    });

    PicarusImage = Backbone.Model.extend({ // TODO: Switch over to PicarusRow
        idAttribute: "row",
        defaults : {
        }
    });
    // TODO: We may want to add a few REST calls, not sure yet
    PicarusImages = Backbone.Collection.extend({
        model : PicarusImage,
        url : "/a1/users/images"
    });

    $.ajaxSetup({
        'beforeSend': function (xhr) {
            login_get(function (email_auth) {
                xhr.setRequestHeader("Authorization", "Basic " + base64.encode(email_auth.email + ":" + email_auth.auth));
            });
        }
    });

    // Based on: https://gist.github.com/2711454
    var all_view = _.map($('#tpls [id*=tpl]'), function (v) {
        return v.id.slice(4).split('_').join('/')
    });

    function capFirst(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    //This is the Backbone controller that manages the content of the app
    var Content = Backbone.View.extend({
        initialize:function(options){
            Backbone.history.on('route',function(source, path){
                this.render(path);
            }, this);
        },
        //This object defines the content for each of the routes in the application
        content: _.object(_.map(all_view, function (val) {
            var selector_id;
            var prefix = 'tpl_';
            if (val === "") {
                selector_id = "data_user"
            } else {
                selector_id = val.split('/').join('_');
            }
            return [val, _.template(document.getElementById(prefix + selector_id).innerHTML, {baseLogin: document.getElementById('bpl_login').innerHTML,
                                                                                              rowSelect: document.getElementById('bpl_row_select').innerHTML,
                                                                                              slicesSelect: document.getElementById('bpl_slices_select').innerHTML,
                                                                                              filter: document.getElementById('bpl_filter').innerHTML,
                                                                                              prefixSelect: document.getElementById('bpl_prefix_select').innerHTML,
                                                                                              runButton: document.getElementById('bpl_run_button').innerHTML})];
        })),
        render:function(route){
            //Simply sets the content as appropriate
            this.$el.html(this.content[route]);
            // Post-process the DOM for Picarus specific helpers
            wrap_hints();
            custom_checkbox_and_radio();
            // Handles post render javascript calls if available
            if (route === "")
                route = 'data/user';
            var func_name = 'render_' + route.split('/').join('_');
            if (window.hasOwnProperty(func_name))
                login_get(window[func_name]);
        }
    });
    
    //This is the Backbone controller that manages the Nav Bar
    var NavBar = Backbone.View.extend({
        initialize:function(options){
            Backbone.history.on('route',function(source, path){
                this.render(path);
            }, this);
        },
        //This is a collection of possible routes and their accompanying
        //user-friendly titles
        titles: _.object(_.map(all_view, function (val) {
            var name;
            if (val === "") {
                name = "user";
            } else {
                name = _.last(val.split('/', 2));
            }
            return [val, capFirst(name)];
        })),
        events:{
            'click a':function(source) {
                var hrefRslt = source.target.getAttribute('href');
                Backbone.history.navigate(hrefRslt, {trigger:true});
                //Cancel the regular event handling so that we won't actual change URLs
                //We are letting Backbone handle routing
                return false;
            }
        },
        //Each time the routes change, we refresh the navigation (dropdown magic by Brandyn)
        render:function(route){
            this.$el.empty();
            var template = _.template("<li class='<%=active%>'><a href='<%=url%>'><%=visible%></a></li>");
            var drop_template = _.template("<li <%=active%>><a href='#'><%=prev_key%></a><ul><% _.each(vals, function(data) { %> <li class='<%=data[2]%>'><a href='#<%=data[0]%>'><%=data[1]%></a></li> <% }); %></ul></li>");
            var prev_els = [];
            var prev_key = undefined;
            var route_key = route.split('/', 2)[0]
            function flush_dropdown(el) {
                el.append(drop_template({prev_key: capFirst(prev_key), vals: prev_els, active: route_key === prev_key ? "class='active'" : ''}));
            }
            for (var key in this.titles) {
                var active = route === key ? 'active' : '';
                var key_splits = key.split('/', 2);
                var name = this.titles[key];
                if (typeof prev_key != 'undefined' && (prev_key != key_splits[0] || key_splits.length < 2)) {
                    flush_dropdown(this.$el);
                    prev_key = undefined;
                    prev_els = [];
                }
                // If a part of a dropdown, add to list, else add directly
                if (key_splits.length >= 2) {
                    prev_key = key_splits[0];
                    prev_els.push([key, name, active]);
                } else {
                    this.$el.append(template({url:'#' + key,visible:this.titles[key],active:active}));
                }
            }
            if (typeof prev_key != 'undefined') {
                flush_dropdown(this.$el);
            }
        }
    });
    
    //Every time a Router is instantiated, the route is added
    //to a global Backbone.history object. Thus, this is just a
    //nice way of defining possible application states
    new (Backbone.Router.extend({
        routes: _.object(_.map(all_view, function (val) {
            return [val, val];
        }).concat([['*path', 'data/user']]))
    }));
    
    //Attach Backbone Views to existing HTML elements
    new NavBar({el:document.getElementById('nav-item-container')});
    new Content({el:document.getElementById('container')});
    
    //Start the app by setting kicking off the history behaviour.
    //We will get a routing event with the initial URL fragment
    Backbone.history.start();
    window.onbeforeunload = function() {return "Leaving Picarus..."};
}