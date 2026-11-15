const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Use Multer Memory Storage (avoids storage-plugin version bugs)
const upload = multer({ storage: multer.memoryStorage() });

// Helper function to stream image buffer directly to Cloudinary
function uploadToCloudinary(fileBuffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { 
                upload_preset: 'realty_preset',
                folder: 'realty-nest-properties' 
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        stream.end(fileBuffer);
    });
}

// 3. Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

// 4. Define Property Schema
const propertySchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    location: { type: String, required: true },
    bhk: { type: String, default: '2 BHK' },
    imageUrl: { type: String, required: true },
    description: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

propertySchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
    }
});

const Property = mongoose.model('Property', propertySchema);

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// GET Route - Fetch all properties
app.get('/api/properties', async (req, res) => {
    try {
        const properties = await Property.find().sort({ createdAt: -1 });
        res.json(properties);
    } catch (err) {
        console.error('Fetch error:', err);
        res.status(500).json({ message: 'Error fetching properties', error: err.message });
    }
});

// POST Route - Add new property with Cloudinary image
app.post('/api/properties', upload.single('imageFile'), async (req, res) => {
    try {
        const { title, price, location, bhk, description } = req.body;
        let imageUrl = 'https://via.placeholder.com/400x250?text=Realty+Nest';

        if (req.file) {
            imageUrl = await uploadToCloudinary(req.file.buffer);
        }

        const newProperty = new Property({
            title,
            price: Number(price),
            location,
            bhk: bhk || '2 BHK',
            imageUrl,
            description
        });

        const savedProperty = await newProperty.save();
        res.status(201).json({ message: 'Property listed successfully!', savedProperty });
    } catch (err) {
        console.error('Save error:', err);
        res.status(500).json({ message: 'Error saving property', error: err.message || err });
    }
});

// PUT Route - Update existing property
app.put('/api/properties/:id', upload.single('imageFile'), async (req, res) => {
    try {
        const { title, price, location, bhk, description } = req.body;
        const existing = await Property.findById(req.params.id);

        if (!existing) {
            return res.status(404).json({ message: 'Property not found' });
        }

        existing.title = title;
        existing.price = Number(price);
        existing.location = location;
        existing.bhk = bhk || existing.bhk;
        existing.description = description;

        if (req.file) {
            existing.imageUrl = await uploadToCloudinary(req.file.buffer);
        }

        const updatedProperty = await existing.save();
        res.json({ message: 'Property updated successfully!', updatedProperty });
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ message: 'Error updating property', error: err.message || err });
    }
});

// DELETE Route - Remove property
app.delete('/api/properties/:id', async (req, res) => {
    try {
        await Property.findByIdAndDelete(req.params.id);
        res.json({ message: 'Property deleted successfully!' });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ message: 'Error deleting property', error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Realty Nest server running on port ${PORT}`);
});
