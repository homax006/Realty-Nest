const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'properties.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure Multer for image storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(express.static('public'));

function getStoredProperties() {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
        return [];
    }
}

function saveProperties(properties) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(properties, null, 2), 'utf8');
}

// GET Route - Fetch all properties
app.get('/api/properties', (req, res) => {
    res.json(getStoredProperties());
});

// POST Route - Add new property
app.post('/api/properties', upload.single('imageFile'), (req, res) => {
    const { title, price, location, bhk, description } = req.body;
    const properties = getStoredProperties();

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/400x250?text=Homax+Estates';

    const newProperty = {
        id: Date.now().toString(),
        title,
        price: Number(price),
        location,
        bhk: bhk || '2 BHK',
        imageUrl,
        description,
        createdAt: new Date().toISOString()
    };

    properties.unshift(newProperty);
    saveProperties(properties);

    res.status(201).json({ message: "Property listed successfully!", savedProperty: newProperty });
});

// PUT Route - Update an existing property by ID
app.put('/api/properties/:id', upload.single('imageFile'), (req, res) => {
    const propertyId = req.params.id;
    const { title, price, location, bhk, description } = req.body;
    let properties = getStoredProperties();
    
    const index = properties.findIndex(p => p.id === propertyId);
    if (index === -1) {
        return res.status(404).json({ message: 'Property not found' });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : properties[index].imageUrl;

    properties[index] = {
        ...properties[index],
        title,
        price: Number(price),
        location,
        bhk: bhk || properties[index].bhk,
        imageUrl,
        description
    };

    saveProperties(properties);
    res.json({ message: 'Property updated successfully!', updatedProperty: properties[index] });
});

// DELETE Route - Remove a property by ID
app.delete('/api/properties/:id', (req, res) => {
    const propertyId = req.params.id;
    let properties = getStoredProperties();
    const updatedProperties = properties.filter(p => p.id !== propertyId);
    saveProperties(updatedProperties);
    res.json({ message: 'Property deleted successfully!' });
});

app.listen(PORT, () => {
    console.log(`Server is running live at http://localhost:${PORT}`);
});