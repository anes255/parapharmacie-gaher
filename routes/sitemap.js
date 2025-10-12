// Backend: Add this to your Express routes
// File: routes/sitemap.js

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Helper function to create URL slug
function createSlug(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Generate sitemap.xml
router.get('/sitemap.xml', async (req, res) => {
    try {
        const baseUrl = process.env.FRONTEND_URL || 'https://yourdomain.com';
        
        // Get all active products
        const products = await Product.find({ actif: true }).select('_id nom categorie dateAjout updatedAt');
        
        // Build XML
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        
        // Home page
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/</loc>\n`;
        xml += '    <changefreq>daily</changefreq>\n';
        xml += '    <priority>1.0</priority>\n';
        xml += '  </url>\n';
        
        // Products list page
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/produits</loc>\n`;
        xml += '    <changefreq>daily</changefreq>\n';
        xml += '    <priority>0.9</priority>\n';
        xml += '  </url>\n';
        
        // Category pages
        const categories = [
            'Vitalité', 'Sport', 'Visage', 'Cheveux', 
            'Solaire', 'Intime', 'Soins', 'Bébé', 'Homme', 'Dentaire'
        ];
        
        categories.forEach(category => {
            const categorySlug = createSlug(category);
            xml += '  <url>\n';
            xml += `    <loc>${baseUrl}/categorie/${categorySlug}</loc>\n`;
            xml += '    <changefreq>weekly</changefreq>\n';
            xml += '    <priority>0.8</priority>\n';
            xml += '  </url>\n';
        });
        
        // Individual product pages
        products.forEach(product => {
            const slug = createSlug(product.nom);
            const lastmod = product.updatedAt || product.dateAjout;
            
            xml += '  <url>\n';
            xml += `    <loc>${baseUrl}/produit/${product._id}-${slug}</loc>\n`;
            xml += `    <lastmod>${lastmod.toISOString().split('T')[0]}</lastmod>\n`;
            xml += '    <changefreq>weekly</changefreq>\n';
            xml += '    <priority>0.7</priority>\n';
            xml += '  </url>\n';
        });
        
        xml += '</urlset>';
        
        res.header('Content-Type', 'application/xml');
        res.send(xml);
        
    } catch (error) {
        console.error('Error generating sitemap:', error);
        res.status(500).send('Error generating sitemap');
    }
});

// Generate robots.txt
router.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.FRONTEND_URL || 'https://yourdomain.com';
    
    const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /checkout

Sitemap: ${baseUrl}/sitemap.xml
`;
    
    res.header('Content-Type', 'text/plain');
    res.send(robotsTxt);
});

module.exports = router;
