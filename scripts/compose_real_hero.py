#!/usr/bin/env python3
"""Real-product Korean Editorial hero.
Source images are original Phùng Hà Korea fanpage photos already licensed in this repo.
Never reconstruct or alter the labels of skincare packages with generative models.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
import math

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"public/assets/hero"
OUT.mkdir(parents=True,exist_ok=True)
SRC=ROOT/"public/assets"
S=3

def photo(path):
    image=Image.open(SRC/path).convert("RGB")
    print("source",path,image.size)
    return image

portrait=photo("fanpage-service-2.jpg")
ampoules=photo("fanpage-product.jpg")
cream=photo("fanpage-service-3.jpg")

def gradient(w,h):
    im=Image.new("RGB",(w,h))
    pix=im.load()
    for y in range(h):
        fy=y/h
        for x in range(w):
            fx=x/w
            v=max(0.0,1.0-math.hypot((fx-.64)*1.4,(fy-.34)*1.0))
            pix[x,y]=(int(245+7*v-3*fy),int(240+9*v-4*fy),int(231+9*v-3*fy))
    return im

def round_frame(image, size, radius=24):
    w,h=size
    ratio=max(w/image.width,h/image.height)
    scaled=image.resize((int(image.width*ratio),int(image.height*ratio)),Image.Resampling.LANCZOS)
    sx=(scaled.width-w)//2
    sy=(scaled.height-h)//2
    cropped=scaled.crop((sx,sy,sx+w,sy+h)).convert("RGBA")
    mask=Image.new("L",(w,h),0)
    dr=ImageDraw.Draw(mask)
    dr.rounded_rectangle((0,0,w-1,h-1),radius=radius,fill=255)
    cropped.putalpha(mask)
    return cropped

def arch_mask(w,h):
    # Rounded top-arched silhouette with fade only where photo ad text appears.
    mask=Image.new("L",(w,h),0)
    draw=ImageDraw.Draw(mask)
    ry=int(w*.53)
    draw.ellipse((0,0,w-1,2*ry),fill=255)
    draw.rectangle((0,ry,w-1,h),fill=255)
    # Make original overlay copy disappear along left photo edge.
    m=mask.load()
    for yy in range(h):
        # Hide ad copy in the upper-left, preserve the authentic RIENA bottle below.
        upper=max(0.0,min(1.0,(690-yy)/190))
        opaque_until=34*(1-upper)+252*upper
        feather_end=opaque_until+(190*(1-upper)+100*upper)
        for xx in range(min(460,w)):
            fade=max(0.0,min(1.0,(xx-opaque_until)/(feather_end-opaque_until)))
            fade=fade*fade*(3-2*fade)
            m[xx,yy]=int(m[xx,yy]*fade)
    return mask.filter(ImageFilter.GaussianBlur(.65))

W,H=960,1200
base=gradient(W,H).convert("RGBA")
d=ImageDraw.Draw(base)
# Decorative gold arch / subtle curves behind real photo
for n in (0,1):
    rect=(150-n*11,50-n*10,940+n*11,1120+n*10)
    d.arc(rect,180,360,fill=(184,164,130,125),width=2)
d.ellipse((-140,720,490,1390),fill=(229,222,207,80))

# Source portrait with *real photographed* RIENA bottle held in hand.
# Crop away left overlay text by soft fading and keep natural face and original pack.
pw,ph=730,1060
crop=portrait.crop((250,0,1056,1410))
crop=ImageEnhance.Color(crop).enhance(.95)
crop=ImageEnhance.Contrast(crop).enhance(1.025)
crop=ImageEnhance.Brightness(crop).enhance(1.025)
crop=crop.resize((pw,ph),Image.Resampling.LANCZOS).convert("RGBA")
crop.putalpha(arch_mask(pw,ph))
base.alpha_composite(crop,(204,62))

# Photo cards with completely authentic, unretouched package labeling.
# Crop far from ad text in the supplied product photographs.
cards=[
    # Original photograph; no synthetic package artwork or ad-copy photo crop.
    (ampoules.crop((205,365,385,628)), (105,894,250,278), -4)
]
for src,(left,top,cw,ch),angle in cards:
    shadow=Image.new("RGBA",(cw+54,ch+58),(0,0,0,0))
    sd=ImageDraw.Draw(shadow)
    sd.rounded_rectangle((17,18,cw+31,ch+32),radius=23,fill=(52,59,47,85))
    shadow=shadow.filter(ImageFilter.GaussianBlur(17))
    shadow=shadow.rotate(angle,Image.Resampling.BICUBIC,expand=True)
    base.alpha_composite(shadow,(left-15,top-10))
    border=Image.new("RGBA",(cw+16,ch+16),(249,247,240,255))
    bd=ImageDraw.Draw(border)
    bd.rounded_rectangle((0,0,cw+15,ch+15),radius=23,fill=(250,247,241,255),outline=(221,215,201,255),width=2)
    exact=round_frame(src,(cw,ch),radius=14)
    border.alpha_composite(exact,(8,8))
    border=border.rotate(angle,Image.Resampling.BICUBIC,expand=True)
    base.alpha_composite(border,(left,top))

# No captions, callouts, site text or fabricated brands in this image.
# Preserve product labels as captured by the original fanpage photos.
rgb=Image.new("RGB",base.size,(248,245,238))
rgb.paste(base,mask=base.getchannel("A"))
for filename,size in [
    ("phungha-real-products-hero-desktop-v1.webp",(960,1200)),
    ("phungha-real-products-hero-mobile-v1.webp",(720,900))
]:
    out=rgb.resize(size,Image.Resampling.LANCZOS)
    dest=OUT/filename
    out.save(dest,"WEBP",quality=84,method=6)
    print("asset",dest.relative_to(ROOT),out.size,dest.stat().st_size)
