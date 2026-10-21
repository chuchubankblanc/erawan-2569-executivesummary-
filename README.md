# Executive Summary ศูนย์เอราวัณ 1669 · ปีงบประมาณ 2569

Dashboard การออกเหตุระบบบริการการแพทย์ฉุกเฉิน กรุงเทพมหานคร แยก 11 โซน (50 เขต)
พร้อมข้อมูลผู้ป่วย: กลุ่มอายุ เพศ การทำ CPR ผลการดูแลรักษาเบื้องต้น (รวมเสียชีวิต ณ จุดเกิดเหตุ) และโรงพยาบาลปลายทาง

หน้าเว็บอยู่ใน `docs/` (เปิดผ่าน GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `docs`)

## อัปเดตข้อมูล

```bash
pip install -r requirements.txt
python scripts/build_data.py <ไฟล์ดิบ .xlsb|.xlsx|.csv|.zip>   # เขียน docs/data/*.json
python scripts/build_site.py                                   # ประกอบ docs/index.html จาก src/
```

ไฟล์ดิบ (คอลัมน์ A–AD: เลขปฏิบัติการ … อายุ เพศ การทำ CPR ผลการดูแลรักษาเบื้องต้น นำส่งห้องฉุกเฉินโรงพยาบาล …)
**ห้าม commit** ขึ้น repo — ใน `docs/data/` มีแต่ตัวเลขรวม ไม่มีเลขปฏิบัติการหรือข้อมูลรายคน

## โครงสร้าง

| path | หน้าที่ |
| --- | --- |
| `config/zones.csv` | ตาราง 50 เขต → โซนเอราวัณ (เขตที่อยู่ 2 โซนแบ่งตามแขวง) |
| `scripts/build_data.py` | คัดเคสและสรุปข้อมูล |
| `scripts/build_site.py` | ประกอบหน้าเว็บ (`docs/index.html`) หรือหน้า Claude Dashboard (`--artifact`) |
| `src/` | style.css · body.html · app.js (ใช้ร่วมกันทั้ง GitHub Pages และ Claude Dashboard) |
| `docs/` | เว็บที่ deploy (index.html, data/*.json, assets/) |

## นิยามหลัก

- 1 เลขปฏิบัติการ = 1 เคส (ตัดแถวซ้ำทั้งแถว แล้วรวมเลขซ้ำ เก็บแถวที่กรอกครบที่สุด)
- โซนจากเขตที่เกิดเหตุ (คอลัมน์ อำเภอ); แถวที่ไม่มีข้อมูลพื้นที่ หรืออยู่นอก กทม. ถูกตัดออกและแสดงในขั้นคัดเคส
- Basic = BLS · Advance = ALS · อื่นๆ = ML + CLS + FR + ERB · ไม่ระบุ = ช่องระดับว่าง
- กลุ่มอายุ: เด็ก 0–14 ปี · ผู้ใหญ่ 15–59 ปี · ผู้สูงอายุ 60 ปีขึ้นไป · อายุ 0/ว่าง/เกิน 120 = ไม่ระบุ
- เพศ 0/ว่าง = ไม่ระบุ · CPR: Yes / Yes,AED/DF / AED/DF / No · โรงพยาบาล 0/ว่าง = ไม่ได้นำส่ง/ไม่มีบันทึก
