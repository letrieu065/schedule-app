import React, { useState, useEffect } from "react";import axios from 'axios';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/vi'; // Import file tiếng Việt để mặc định Thứ 2 là đầu tuần
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './App.css'; 

// Thiết lập ngôn ngữ tiếng Việt cho moment
moment.updateLocale('vi', {
  week: {
    dow: 1, 
  }
});
const localizer = momentLocalizer(moment);

function App() {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('Linh'); 
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [hourlyRate, setHourlyRate] = useState(19000); // Lương mặc định 25k/h
  const [salaryData, setSalaryData] = useState(null);
  // Hiệu ứng popup chúc mừng sinh nhật khi vừa vào web
  useEffect(() => {
    // Thay tên bạn gái và lời chúc của bạn vào đây nhé
    alert("🎉 Chúc mừng sinh nhật xói thúi của anh, chúc xói thúi tuổi mới luôn đầy năng lượng và xinh đệp nhé. Em hãy luôn tiến lên về phía trước và hãy làm bất cứ điều gì mà em muốn bất kể hậu quả vì đằng sau luôn có anh ủng hộ và giải quyết mọi điều em ghét, mọi điều em không thích miễn là em muốn. Hãy luôn là chính mình kệ những gì anh nói, anh nói cái mỏ như vậy thôi chứ em làm gì anh cũng thích hết, anh nói là vì muốn chia sẻ với em muốn trò chuyện với em để em vui hơn thôi.❤️");
  }, []);
  // Hàm lấy dữ liệu từ MongoDB
  const fetchSchedules = async () => {
    try {
      // Đổi URL này thành URL Render của bạn
      const response = await axios.get(`https://schedule-app-1j0o.onrender.com/api/schedules?name=${name}`);
      const formattedEvents = response.data.events.map(ev => ({
          ...ev,
          start: new Date(ev.start),
          end: new Date(ev.end),
      }));
      setEvents(formattedEvents);
      if (formattedEvents.length > 0) {
        setCalendarDate(formattedEvents[0].start);
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu", error);
    }
  };
    const fetchSalary = async () => {
    try {
      const res = await axios.get(`https://schedule-app-1j0o.onrender.com/api/salary?name=${name}&month=${selectedMonth}&year=${selectedYear}&hourlyRate=${hourlyRate}`);
      setSalaryData(res.data);
    } catch (error) {
      console.error("Lỗi tính lương", error);
    }
  };

  // Gọi tự động mỗi khi đổi tháng hoặc đổi mức lương
  useEffect(() => {
    fetchSalary();
  }, [name, selectedMonth, selectedYear, hourlyRate]);

  // Tự động chạy hàm trên mỗi khi trang tải xong HOẶC khi đổi tên người tìm kiếm
  useEffect(() => {
    fetchSchedules();
  }, [name]); 

  const handleUpload = async () => {
    if (!file) return alert("Vui lòng chọn ảnh lịch!");
    
    setLoading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('name', name);

    try {
      const response = await axios.post('https://schedule-app-1j0o.onrender.com/api/extract-schedule', formData);
      
      const formattedEvents = response.data.events.map(ev => ({
          ...ev,
          start: new Date(ev.start),
          end: new Date(ev.end),
      }));

      setEvents(formattedEvents);
      
      if (formattedEvents.length > 0) {
        setCalendarDate(formattedEvents[0].start);
      } else {
        alert("AI không tìm thấy tên nhân viên này trong ảnh!");
      }
    } catch (error) {
      console.error(error);
      alert("Lỗi khi đọc ảnh, vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  // Hàm tùy chỉnh màu sắc cho từng ca làm việc
  const eventStyleGetter = (event) => {
    let backgroundColor = '#3174ad'; 
    if (event.shift === 1) backgroundColor = '#f59e0b'; // Ca 1: Màu cam
    if (event.shift === 2) backgroundColor = '#10b981'; // Ca 2: Màu xanh lá
    if (event.shift === 3) backgroundColor = '#3b82f6'; // Ca 3: Màu xanh dương

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.95,
        color: 'white',
        border: 'none',
        fontWeight: 'bold',
        padding: '4px 8px',
      }
    };
  };

  return (
    
    <div className="app-container">
      <div className="header">
        <div style={{ textAlign: 'center', marginBottom: '15px', color: '#e11d48', fontWeight: 'bold' }}>
  🎂 Happy Birthday Linh! Chúc em có một ngày làm việc thật rực rỡ và ngọt ngào! ✨
</div>
        <h1>🗓️ Đồng Bộ Lịch Làm Việc</h1>
        <p>Phân tích ảnh và trích xuất thời gian biểu tự động bằng AI</p>
      </div>
      
      <div className="control-card">
        <div className="input-group">
          <label>Tên nhân viên:</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Ví dụ: Chiêu, Linh..."
            className="text-input"
          />
        </div>
        
        <div className="input-group">
          <label>Ảnh lịch làm việc:</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => setFile(e.target.files[0])} 
            className="file-input"
          />
        </div>
        
        <button className="upload-btn" onClick={handleUpload} disabled={loading}>
          {loading ? '⏳ Đang phân tích...' : '✨ Dò Lịch Ngay'}
        </button>
      </div>

      <div className="calendar-card">
        <Calendar
          localizer={localizer}
          culture="vi"
          events={events}
          startAccessor="start"
          endAccessor="end"
          defaultView="week"
          views={['week', 'month', 'day']}
          date={calendarDate}
          onNavigate={(newDate) => setCalendarDate(newDate)}
          eventPropGetter={eventStyleGetter}
          
          // THÊM ĐÚNG DÒNG NÀY ĐỂ TẮT CHẾ ĐỘ THU HẸP SỰ KIỆN
          dayLayoutAlgorithm="no-overlap" 
        />
      </div>
          {/* Khung tính lương tháng */}
    <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', margin: '20px 0', border: '1px solid #e2e8f0' }}>
      <h3>💰 Thống kê lương tháng {selectedMonth}/{selectedYear}</h3>
      <div style={{ display: 'flex', gap: '10px', margin: '10px 0', flexWrap: 'wrap' }}>
        <label>
          Tháng: 
          <input type="number" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ width: '60px', marginLeft: '5px' }} />
        </label>
        <label>
          Năm: 
          <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ width: '80px', marginLeft: '5px' }} />
        </label>
        <label>
          Lương/giờ (VNĐ): 
          <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} style={{ width: '100px', marginLeft: '5px' }} />
        </label>
        <button onClick={fetchSalary} style={{ background: '#0284c7', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' }}>Cập nhật</button>
      </div>

      {salaryData && (
        <div style={{ fontSize: '16px', fontWeight: '500', color: '#334155' }}>
          <p>✨ Tổng số ca làm: <strong>{salaryData.totalShifts} ca</strong></p>
          <p>⏳ Tổng số giờ làm: <strong>{salaryData.totalHours} giờ</strong></p>
          <p style={{ color: '#16a34a', fontSize: '18px' }}>💵 Tổng lương thực nhận: <strong>{salaryData.totalSalary.toLocaleString()} VNĐ</strong></p>
        </div>
      )}
    </div>
    </div>
  );
}

export default App;