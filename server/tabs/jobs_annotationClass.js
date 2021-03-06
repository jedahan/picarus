function render_jobs_annotationClass() {
    slices_selector();
    $('#runButton').click(function () {
        var startRow = unescape($('#startRow').val());
        var stopRow = unescape($('#stopRow').val());
        var imageColumn = 'thum:image_150sq';
        var numTasks = Number($('#num_tasks').val());
        var classColumn = $('#class').val();
        var mode = $('#modeSelect').val();
        $('#results').html('');
        function success(response) {
            JOBS.fetch();
            $('#results').append($('<a>').attr('href', '/v0/annotation/' + response.row + '/index.html').text('Worker').attr('target', '_blank'));
        }
        PICARUS.postTable('jobs', {success: success, data: {path: 'annotation/images/class', slices: slices_selector_get().join(';'), imageColumn: imageColumn, classColumn: classColumn, instructions: $('#instructions').val(), numTasks: numTasks, mode: mode}});
    });
}