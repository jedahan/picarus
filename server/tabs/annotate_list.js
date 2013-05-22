function render_annotate_list() {
    var workerColumn = {header: "Worker", getFormatted: function() {
        return Mustache.render("<a href='/v0/annotation/{{task}}/index.html' target='_blank'>Worker</a>", {task: this.escape('row')});
    }};
    var syncColumn = {header: "Sync", getFormatted: function() { return '<span style="font-size:5px"><a class="tasks-sync" row="' + encode_id(this.get('row')) + '">sync</a></span>'}};

    function postRender() {
        $('.tasks-sync').click(function (data) {
            var row = decode_id(data.target.getAttribute('row'));
            var model = JOBS.get(row);
            PICARUS.postRow('annotations', row, {data: {'action': 'io/annotation/sync'}});
        });
    }
    // TODO: Filter based on type == annotation
    new RowsView({collection: JOBS, el: $('#annotations'), extraColumns: [workerColumn, syncColumn], postRender: postRender, deleteRows: true});
}