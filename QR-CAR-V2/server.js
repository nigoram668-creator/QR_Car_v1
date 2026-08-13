const express = require("express");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, "cars.json");
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

let cars = [];

// ==============================
// MA'LUMOTLARNI YUKLASH
// ==============================

function loadCars() {
    if (!fs.existsSync(DATA_FILE)) {
        cars = [];
        saveCars();
        return;
    }

    try {
        const data = fs.readFileSync(DATA_FILE, "utf8");

        if (data.trim() === "") {
            cars = [];
        } else {
            cars = JSON.parse(data);
        }

        if (!Array.isArray(cars)) {
            cars = [];
        }

    } catch (error) {
        console.log("cars.json o'qishda xato");
        cars = [];
    }
}

// ==============================
// MA'LUMOTLARNI SAQLASH
// ==============================

function saveCars() {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(cars, null, 2),
        "utf8"
    );
}

// ==============================
// QR ID YARATISH
// ==============================

function generateQRId() {

    let number = 1;

    while (true) {

        const id =
            "QRCAR" +
            String(number).padStart(4, "0");

        const exists = cars.some(function(car) {
            return car.qr_id === id;
        });

        if (!exists) {
            return id;
        }

        number++;
    }
}

// ==============================
// QR TOPISH
// ==============================

function findCar(id) {

    return cars.find(function(car) {
        return car.qr_id === id;
    });

}

// Yuklash
loadCars();


// ==============================
// ADMIN QR YARATISH
// ==============================

app.post("/api/admin/generate-qr", function(req, res) {

    let count = Number(req.body.count || 1);

    if (!Number.isInteger(count)) {
        count = 1;
    }

    if (count < 1) {
        count = 1;
    }

    if (count > 1000) {
        count = 1000;
    }

    const ids = [];

    for (let i = 0; i < count; i++) {

        const qrId = generateQRId();

        cars.push({

            qr_id: qrId,

            registered: false,

            name: "",
            phone: "",
            car_model: "",
            car_number: "",
            info: "",

            username: "",
            password: "",

            created_at: new Date().toISOString()

        });

        ids.push(qrId);
    }

    saveCars();

    res.json({
        success: true,
        ids: ids
    });

});


// ==============================
// QR MA'LUMOTINI OLISH
// ==============================

app.get("/api/car/:id", function(req, res) {

    const car = findCar(req.params.id);

    if (!car) {

        return res.status(404).json({
            success: false,
            error: "QR ID topilmadi"
        });

    }

    res.json({

        success: true,

        qr_id: car.qr_id,

        registered: car.registered,

        name: car.name,
        phone: car.phone,
        car_model: car.car_model,
        car_number: car.car_number,
        info: car.info

    });

});


// ==============================
// REGISTRATSIYA
// ==============================

app.post("/api/register", function(req, res) {

    const qrId =
        String(req.body.qr_id || "").trim();

    const name =
        String(req.body.name || "").trim();

    const phone =
        String(req.body.phone || "").trim();

    const carModel =
        String(req.body.car_model || "").trim();

    const carNumber =
        String(req.body.car_number || "").trim();

    const info =
        String(req.body.info || "").trim();

    const username =
        String(req.body.username || "").trim();

    const password =
        String(req.body.password || "");

    if (!qrId) {
return res.status(400).json({
            success: false,
            error: "QR ID kerak"
        });

    }

    if (!name) {

        return res.status(400).json({
            success: false,
            error: "Ismni kiriting"
        });

    }

    if (!phone) {

        return res.status(400).json({
            success: false,
            error: "Telefon raqamni kiriting"
        });

    }

    if (!username || !password) {

        return res.status(400).json({
            success: false,
            error: "Login va parol kerak"
        });

    }

    const car = findCar(qrId);

    if (!car) {

        return res.status(404).json({
            success: false,
            error: "Bunday QR kod mavjud emas"
        });

    }

    // FAQAT BIR MARTA REGISTRATSIYA

    if (car.registered === true) {

        return res.status(409).json({
            success: false,
            error: "Bu QR kod allaqachon registratsiya qilingan"
        });

    }

    // LOGIN TAKRORLANMASIN

    const loginExists = cars.some(function(item) {

        return item.username === username;

    });

    if (loginExists) {

        return res.status(409).json({
            success: false,
            error: "Bu login allaqachon ishlatilgan"
        });

    }

    car.registered = true;

    car.name = name;
    car.phone = phone;
    car.car_model = carModel;
    car.car_number = carNumber;
    car.info = info;

    car.username = username;
    car.password = password;

    car.created_at =
        new Date().toISOString();

    saveCars();

    res.json({

        success: true,

        message: "Registratsiya muvaffaqiyatli",

        qr_id: car.qr_id

    });

});


// ==============================
// LOGIN
// ==============================

app.post("/api/login", function(req, res) {

    const username =
        String(req.body.username || "").trim();

    const password =
        String(req.body.password || "");

    const car = cars.find(function(item) {

        return (
            item.username === username &&
            item.password === password
        );

    });

    if (!car) {

        return res.status(401).json({
            success: false,
            error: "Login yoki parol xato"
        });

    }

    res.json({

        success: true,

        qr_id: car.qr_id

    });

});


// ==============================
// QR PNG
// ==============================

app.get("/api/qr/:id.png", async function(req, res) {

    const car = findCar(req.params.id);

    if (!car) {

        return res.status(404).send(
            "QR ID topilmadi"
        );

    }

    try {

        const baseUrl =
            req.protocol +
            "://" +
            req.get("host");

        const qrUrl =
            baseUrl +
            "/car/" +
            car.qr_id;

        const image =
            await QRCode.toBuffer(qrUrl, {

                width: 600,

                margin: 2

            });

        res.type("png");

        res.send(image);

    } catch (error) {

        console.log(
            "QR yaratishda xato:",
            error.message
        );

        res.status(500).send(
            "QR yaratishda xatolik"
        );

    }

});


// ==============================
// QR SKANERLANGANDA
// ==============================

app.get("/car/:id", function(req, res) {

    const car = findCar(req.params.id);

    if (!car) {

        return res.status(404).send(
            "QR ID topilmadi"
        );

    }

    if (car.registered === false) {

        return res.redirect(
            "/register.html?qr=" +
            encodeURIComponent(car.qr_id)
        );

    }

    return res.redirect(
        "/car.html?qr=" +
        encodeURIComponent(car.qr_id)
    );

});


// ==============================
// BOSH SAHIFA
// ==============================

app.get("/", function(req, res) {

    res.sendFile(
        path.join(
            PUBLIC_DIR,
            "index.html"
        )
    );

});


// ==============================
// SERVER
// ==============================
app.listen(
    PORT,
    "0.0.0.0",
    function() {

        console.log(
            "QR CAR V2 server ishlayapti: port " +
            PORT
        );

    }
);
