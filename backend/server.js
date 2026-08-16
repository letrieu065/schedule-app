const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose'); // THÊM DÒNG NÀY
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. KẾT NỐI MONGODB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Đã kết nối MongoDB thành công! 🚀'))
  .catch(err => console.error('Lỗi kết nối MongoDB:', err));

// 2. TẠO MODEL LƯU TRỮ LỊCH
const scheduleSchema = new mongoose.Schema({
    name: String,
    date: String,
    shift: Number,
    start: Date,
    end: Date
});
const Schedule = mongoose.model('Schedule', scheduleSchema);

const upload = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/extract-schedule', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Vui lòng tải ảnh lên" });
        
        const targetName = req.body.name || "Chiêu"; 
        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            },
        };

        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" }); // Hoặc model bạn đang dùng ổn định
        
        const prompt = `Đây là ảnh lịch làm việc của một quán ăn/cafe. 
        - Các hàng được chia làm 3 ca: CA 1 (8H-12H), CA 2 (12H-17H30), CA 3 (17H30-22H).
        - Các cột từ Thứ 2 đến Chủ nhật, trên tiêu đề có ghi ngày.
        - Tên nhân viên nằm bên trong các ô.
        Hãy tìm các ô có chứa tên '${targetName}'. 
        Trả về MỘT MẢNG JSON duy nhất: {"date": "YYYY-MM-DD", "shift": số_ca}. Chỉ trả về JSON.`;

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text();
        
        let scheduleData = [];
        const match = responseText.match(/\[[\s\S]*\]/);
        if (match) {
            scheduleData = JSON.parse(match[0]);
        } else {
            return res.status(400).json({ error: "AI không tìm thấy dữ liệu" });
        }

        const events = scheduleData.map((item) => {
            let startHour = "08:00:00";
            let endHour = "12:00:00";
            
            if (item.shift === 2) {
                startHour = "12:00:00";
                endHour = "17:30:00";
            } else if (item.shift === 3) {
                startHour = "17:30:00";
                endHour = "22:00:00";
            }

            return {
                name: targetName,
                start: new Date(`${item.date}T${startHour}`),
                end: new Date(`${item.date}T${endHour}`),
                shift: item.shift,
                date: item.date
            };
        });

        // 3. XÓA LỊCH CŨ VÀ LƯU LỊCH MỚI VÀO DATABASE
        await Schedule.deleteMany({ name: targetName }); // Tùy chọn: Xóa lịch cũ của người này để tránh trùng lặp
        const savedEvents = await Schedule.insertMany(events);

        res.json({ events: savedEvents });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Lỗi server" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend đang chạy ở port ${PORT}`));