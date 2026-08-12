const express = require("express");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

const DATA_FILE = path.join(__dirname, "cars.json");

let cars = [];

// Ma'lumotlarni yuklash
if (fs.existsSync(DATA_FILE)) {
  try {
    cars = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    if (!Array.isArray(cars)) {
      cars = [];
    }
  } catch (error) {
    console.log("cars.json o'qilmadi");
    cars = [];
  }
}

// Ma'lumotlarni saqlash
function saveCars() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(cars, null, 2),
    "utf8"
  );
}

// Yangi QR ID yaratish
function generateQRId() {
  let number = 1;

  while (
    cars.some(
      car =>
        car.qr_id ===
        QRCAR${String(number).padStart(4, "0")}
    )
  ) {
    number++;
  }

  return QRCAR${String(number).padStart(4, "0")};
}


// ================================
// ADMIN — QR YARATISH
// ================================

app.post("/api/admin/generate-qr", (req, res) => {
  let count = Number(req.body.count || 1);

  if (!Number.isInteger(count) || count < 1) {
    count = 1;
  }

  if (count > 1000) {
    count = 1000;
  }

  const ids = [];

  for (let i = 0; i < count; i++) {
    const qr_id = generateQRId();

    cars.push({
      qr_id: qr_id,

      registered: false,

      name: "",
      phone: "",
      car_model: "",
      car_number: "",
      info: "",

      username: "",
      password: "",

      created_at: null
    });

    ids.push(qr_id);
  }

  saveCars();

  res.json({
    success: true,
    ids: ids
  });
});


// ================================
// QR MA'LUMOTINI OLISH
// ================================

app.get("/api/car/:id", (req, res) => {
  const car = cars.find(
    item => item.qr_id === req.params.id
  );

  if (!car) {
    return res.status(404).json({
      error: "QR ID topilmadi"
    });
  }

  res.json({
    qr_id: car.qr_id,

    registered: car.registered,

    name: car.name,
    phone: car.phone,
    car_model: car.car_model,
    car_number: car.car_number,
    info: car.info
  });
});


// ================================
// BIR MARTALIK REGISTRATSIYA
// ================================

app.post("/api/register", (req, res) => {
  const {
    qr_id,
    name,
    phone,
    car_model,
    car_number,
    info,
    username,
    password
  } = req.body;

  if (!qr_id) {
    return res.status(400).json({
      error: "QR ID kerak"
    });
  }

  if (!name || !phone) {
    return res.status(400).json({
      error: "Ism va telefon raqam kerak"
    });
  }

  if (!username || !password) {
    return res.status(400).json({
      error: "Login va parol kerak"
    });
  }

  const car = cars.find(
    item => item.qr_id === qr_id
  );

  if (!car) {
    return res.status(404).json({
      error: "Bunday QR mavjud emas"
    });
  }

  // QR faqat BIR MARTA registratsiya qilinadi
  if (car.registered === true) {
    return res.status(409).json({
      error:
        "Bu QR kod allaqachon ro'yxatdan o'tgan"
    });
  }

  car.registered = true;

  car.name = String(name).trim();

  car.phone = String(phone).trim();

  car.car_model =
    String(car_model || "").trim();

  car.car_number =
    String(car_number || "").trim();

  car.info =
    String(info || "").trim();

  car.username =
    String(username).trim();

  car.password =
    String(password);

  car.created_at =
    new Date().toISOString();

  saveCars();

  res.json({
    success: true,

    message:
      "Registratsiya muvaffaqiyatli",

    qr_id: car.qr_id
  });
});


// ================================
// LOGIN
// ================================

app.post("/api/login", (req, res) => {
  const {
    username,
    password
  } = req.body;

  const car = cars.find(
    item =>
      item.username === username &&
      item.password === password
  );
if (!car) {
    return res.status(401).json({
      error: "Login yoki parol xato"
    });
  }

  res.json({
    success: true,
    qr_id: car.qr_id
  });
});


// ================================
// QR PNG YARATISH
// ================================

app.get("/api/qr/:id.png", async (req, res) => {
  try {
    const car = cars.find(
      item => item.qr_id === req.params.id
    );

    if (!car) {
      return res.status(404).send(
        "QR ID topilmadi"
      );
    }

    const base =
      ${req.protocol}://${req.get("host")};

    const url =
      ${base}/car/${car.qr_id};

    const image =
      await QRCode.toBuffer(url, {
        width: 600,
        margin: 2
      });

    res.type("png").send(image);

  } catch (error) {
    console.error(error);

    res.status(500).send(
      "QR yaratishda xatolik"
    );
  }
});


// ================================
// QR SKANERLANGANDA
// ================================

app.get("/car/:id", (req, res) => {
  const car = cars.find(
    item => item.qr_id === req.params.id
  );

  if (!car) {
    return res.status(404).send(
      "QR ID topilmadi"
    );
  }

  // Hali registratsiya qilinmagan
  if (!car.registered) {
    return res.redirect(
      /register.html?qr=${car.qr_id}
    );
  }

  // Registratsiya qilingan
  return res.redirect(
    /car.html?qr=${car.qr_id}
  );
});


// ================================
// BOSH SAHIFA
// ================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});


// ================================
// SERVERNI ISHGA TUSHIRISH
// ================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      QR CAR V2 ${PORT} portda ishlayapti
    );
  }
);
