from PIL import Image
import os

src = r'C:/Users/33126/Documents/DIY/_work/nova-render-test/yuheng-web-web.png'
out = r'C:/Users/33126/Documents/DIY/_work/project-nova-site/public/yuheng'
os.makedirs(out, exist_ok=True)

im = Image.open(src).convert('RGBA')
W, H = im.size
bbox = im.getbbox()
print('src', im.size, 'bbox', bbox)

# 把透明白边裁到主体 + 3% 留白，并裁成正方形，避免首页里模型被空边稀释
x0, y0, x1, y1 = bbox
pad = int(max(x1 - x0, y1 - y0) * 0.03)
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
side = max(x1 - x0, y1 - y0) + pad * 2
half = side // 2
box = (max(0, cx - half), max(0, cy - half), min(W, cx + half), min(H, cy + half))
im = im.crop(box)
print('crop', box, '->', im.size)

im.save(out + '/yuheng-core.webp', 'WEBP', quality=92, method=6)
im.resize((im.width // 2, im.height // 2), Image.LANCZOS).save(out + '/yuheng-core-700.webp', 'WEBP', quality=92, method=6)
for f in ['yuheng-core.webp', 'yuheng-core-700.webp']:
    print(f, os.path.getsize(out + '/' + f), Image.open(out + '/' + f).size)