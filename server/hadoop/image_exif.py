#!/usr/bin/env python
import hadoopy
from PIL.ExifTags import TAGS
from PIL import Image
import cStringIO as StringIO
import json
import picarus
import base64
import sys


class Mapper(picarus.HBaseMapper):

    def __init__(self):
        super(Mapper, self).__init__()

    def _map(self, row, image_binary):
        try:
            image = Image.open(StringIO.StringIO(image_binary))
            if not hasattr(image, '_getexif'):
                yield row, json.dumps({})
            else:
                image_tags = image._getexif()
                if image_tags is None:
                    yield row, json.dumps({})
                else:
                    yield row, json.dumps({name: base64.b64encode(image_tags[id]) if isinstance(image_tags[id], str) else image_tags[id]
                                           for id, name in TAGS.items()
                                           if id in image_tags})
        except:
            sys.stdout.flush()
            hadoopy.counter('STATUS', 'badRows')
        else:
            sys.stdout.flush()
            hadoopy.counter('STATUS', 'goodRows')

if __name__ == '__main__':
    hadoopy.run(Mapper, required_cmdenvs=['HBASE_TABLE', 'HBASE_OUTPUT_COLUMN'])
