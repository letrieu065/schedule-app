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
        // Lấy năm hiện tại để ép AI không được đoán mò
        const currentYear = new Date().getFullYear();
        
        const prompt = `Đây là ảnh lịch làm việc của một quán ăn/cafe. 
        - Các hàng được chia làm 3 ca: CA 1 (8H-12H), CA 2 (12H-17H30), CA 3 (17H30-22H).
        - Các cột từ Thứ 2 đến Chủ nhật, trên tiêu đề có thể có ghi ngày.
        - Tên nhân viên nằm bên trong các ô.
        
        LƯU Ý QUAN TRỌNG VỀ THỜI GIAN:
        - Năm mặc định là ${currentYear}. 
        - Nếu trên ảnh chỉ ghi ngày/tháng (ví dụ 4/8, 5/8), BẮT BUỘC phải ghép với năm ${currentYear} để thành định dạng (ví dụ: ${currentYear}-08-04).
        - Nếu ảnh chỉ ghi "Thứ 2", "Thứ 3" mà hoàn toàn không có ngày, hãy tự động lấy ngày của Thứ 2, Thứ 3 trong tuần hiện tại của năm ${currentYear} để điền vào.

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
                start: new Date(`${item.date}T${startHour}+07:00`), // Thêm +07:00
                end: new Date(`${item.date}T${endHour}+07:00`),   // Thêm +07:00
                shift: item.shift,
                date: item.date
            };
        });

        // 3. XÓA LỊCH CŨ VÀ LƯU LỊCH MỚI VÀO DATABASE
        // 3. THAY VÌ XÓA HẾT, TA SẼ CỘNG DỒN HOẶC CẬP NHẬT TỪNG NGÀY TRONG ẢNH MỚI
        for (const item of events) {
            // Kiểm tra xem nhân viên này vào ngày đó đã có ca làm chưa
            await Schedule.findOneAndUpdate(
                { name: targetName, date: item.date }, // Điều kiện tìm kiếm: đúng người, đúng ngày
                { 
                    start: item.start,
                    end: item.end,
                    shift: item.shift 
                },
                { upsert: true, new: true } // Nếu có rồi thì sửa, chưa có thì tự động tạo mới (Thêm vào)
            );
        }

        // Lấy lại toàn bộ lịch của nhân viên đó (bao gồm cả tuần cũ và tuần mới) để trả về cho frontend
        const savedEvents = await Schedule.find({ name: targetName });

        res.json({ events: savedEvents });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Lỗi server" });
    }
});

const PORT = process.env.PORT || 5000;
app.get('/api/schedules', async (req, res) => {
    try {
        const targetName = req.query.name || "Chiêu";
        const events = await Schedule.find({ name: targetName });
        res.json({ events });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Lỗi lấy dữ liệu" });
    }
});
app.get('/api/salary', async (req, res) => {
    try {
        const { name, month, year, hourlyRate } = req.query;
        if (!name || !month || !year) {
            return res.status(400).json({ error: "Thiếu thông tin tên, tháng hoặc năm!" });
        }

        // Tạo khoảng thời gian từ ngày đầu đến ngày cuối tháng
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // Lọc các ca làm của nhân viên trong tháng đó
        const schedules = await Schedule.find({
            name: name,
            start: { $gte: startDate, $lte: endDate }
        });

        let totalHours = 0;
        schedules.forEach(item => {
            const durationMs = new Date(item.end) - new Date(item.start);
            const hours = durationMs / (1000 * 60 * 60); // Đổi ra số giờ
            totalHours += hours;
        });

        const rate = parseFloat(hourlyRate) || 25000; // Mặc định lương 25k/h nếu không nhập
        const totalSalary = totalHours * rate;

        res.json({
            name,
            month: `${month}/${year}`,
            totalShifts: schedules.length,
            totalHours: totalHours.toFixed(1),
            hourlyRate: rate,
            totalSalary: totalSalary
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Lỗi tính lương" });
    }
});
app.listen(PORT, () => console.log(`Backend đang chạy ở port ${PORT}`));