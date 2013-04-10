function render_crawl_flickr() {
    row_selector($('#rowPrefixDrop'), $('#startRow'), $('#stopRow'));
    $('#runButton').click(function () {
        button_running();
        var demo_class = $('#democlass').val();
        var demo_query = $('#demoquery').val();
        var row_prefix = $('#rowPrefixDrop').val();
        if (demo_query.length == 0 && row_prefix.length == 0) {
            display_alert('Must specify query and prefix');
            return;
        }
        queries = _.shuffle(demo_query.split(';'));
        var iters = parseInt($('#demoiters').val())
        var simul = 10;
        if (isNaN(iters) || iters < 1 || iters > 20) {
            display_alert('Iters must be 0 < x <= 20');
            return;
        }
        $('#numRows').html('');
        /* Check input */
        //reset_state();
        var min_time = 1232170610;
        var latitude = Number($('#demolat').val());
        var longitude = Number($('#demolon').val());
        var done = 0;

        states = [];
        _.each(queries, function (query) {
            var state = {query: query, className: demo_class};
            _.each(_.range(iters), function () {states.push(state)});
        });
        states = _.shuffle(states);
        simul = Math.min(simul, states.length);
        function call_api(state) {
            var timeRadius = 60 * 60 * 24 * 30 * 3; // 3 months
            var minUploadDate = parseInt((new Date().getTime() / 1000 - min_time) * Math.random() + min_time - timeRadius);
            var maxUploadDate = parseInt(timeRadius * 2 + minUploadDate);
            var p = {hasGeo: Number($('#demogeo').is(':checked')), query: state.query, minUploadDate: minUploadDate, maxUploadDate: maxUploadDate, action: 'o/crawl/flickr'};
            if (state.className.length)
                p.className = state.className;
            if (latitude && longitude) {
                p.lat = String(latitude);
                p.lon = String(longitude);
            }
            function success(xhr) {
                var response = JSON.parse(xhr.responseText);
                function etod(e) {
                    var d = new Date(0);
                    d.setUTCSeconds(e);
                    return d.toString();
                }
                var data = {minUploadDate: etod(minUploadDate), maxUploadDate: etod(maxUploadDate), numRows: response.numRows};
                $('#numRows').append('Crawl Finished : ' + state.query + ' '+ JSON.stringify(data) + '<br>');
                if (!states.length) {
                    simul -= 1;
                    if (!simul)
                        button_reset();
                    return;
                }
                call_api(states.pop());
            }
            picarus_api("/a1/slice/images/" + encode_id(row_prefix) + '/' + encode_id(prefix_to_stop_row(row_prefix)), "POST", {success: success, data: p});
        }
        _.each(_.range(simul), function () {call_api(states.pop())});
    });
}