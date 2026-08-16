require('dotenv').config();

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        
        console.log("=== DANH SÁCH MODEL BẠN ĐƯỢC PHÉP DÙNG ===");
        data.models.forEach(m => {
            // Chỉ in ra các model hỗ trợ tạo nội dung (generateContent)
            if (m.supportedGenerationMethods.includes("generateContent")) {
                // Tên model sẽ có dạng 'models/tên-model'
                console.log(m.name.replace('models/', '')); 
            }
        });
    } catch (error) {
        console.error("Lỗi:", error);
    }
}

listModels();