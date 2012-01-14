import keyframe
import hadoopy
import tempfile
import imfeat
import vidfeat


class Mapper(object):

    def __init__(self):
        # MIN_INTERVAL: The shortest period of time (sec) that keyframes can be output.  Anything faster
        # than this is not output as a keyframe. (default: 3)
        # FRAME_SKIP: Amount of time between frames considered (converted after reading FPS from video)
        self.kf = keyframe.SURF(min_interval=float(os.environ.get('MIN_INTERVAL', 3)))
        self.frame_skip = float(os.environ.get('FRAME_SKIP', 0.))
        

    def map(self, event_filename, video_data):
        """

        Args:
            event_filename: Tuple of (event, filename)
            video_data: Binary video data

        Yields:
            A tuple in the form of ((event, filename), value) where value is a dict
            with contents

            prev_frame_time:
            prev_frame_num:
            prev_frame:
            frame_time:
            frame_num:
            frame:
        """
        ext = '.' + event_filename[1].rsplit('.')[1]
        with tempfile.NamedTemporaryFile(suffix=ext) as fp:
            fp.write(video_data)
            fp.flush()
            prev_frame_time = None
            prev_frame_num = None
            prev_frame = None
            try:
                for (frame_num, frame_time, frame), iskeyframe in self.kf(vidfeat.convert_video_ffmpeg(fp.name, modes=('frameiterskiptime', self.kf.MODES,
                                                                                                                       self.frame_skip),
                                                                                                       frozen=True)):
                    if iskeyframe and prev_frame:
                        yield event_filename, {'prev_frame_time': prev_frame_time,
                                               'prev_frame_num': prev_frame_num,
                                               'prev_frame': imfeat.image_tostring(prev_frame, 'JPEG'),
                                               'frame_time': frame_time,
                                               'frame_num': frame_num,
                                               'frame': imfeat.image_tostring(frame, 'JPEG')}
                    prev_frame_num = frame_num
                    prev_frame = frame
            except:
                hadoopy.counter('VIDEO_ERROR', 'FFMPEGCantParse')


if __name__ == '__main__':
    hadoopy.run(Mapper)
