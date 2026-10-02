# Hola Maps category taxonomy

Hola Maps keeps two product layers of categories:

## Discovery categories shown on the homepage

- Cafe
- Ăn uống
- Homestay
- Villa
- Check-in
- Trải nghiệm

These remain the curated homepage rows.

## Tourism and utility categories available on Map, Admin and imports

- Khu du lịch
- Trường học
- Y tế
- Siêu thị & cửa hàng
- Ngân hàng & ATM
- Nhiên liệu & sạc EV
- Cơ quan công cộng
- Thể thao
- Dịch vụ
- Giao thông
- Bất động sản

The Overture Places importer maps common taxonomy terms into all 17 Hola Maps
categories. Unknown or ambiguous Overture categories remain in REVIEW instead
of being forced into an incorrect category.


### Khu du lịch vs Check-in vs Trải nghiệm

- **Khu du lịch**: tourist destinations, tourism/recreation complexes, resort areas, theme/amusement/water parks and similar destination-scale places.
- **Check-in**: viewpoints, landmarks, monuments, scenic spots, parks and individual attractions.
- **Trải nghiệm**: activities and venues such as museums, galleries, camping and events.

The importer keeps generic `tourist_attraction` in **Check-in** instead of
blindly classifying every attraction as a destination-scale **Khu du lịch**.
