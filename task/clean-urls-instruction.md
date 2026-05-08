# How to Use Clean URLs (Pretty URLs)

To ensure your website uses URLs like `/page-name/` instead of `/page-name.html`, follow these instructions:

## 1. Update Your HTML Links
- Always link to `/page-name/` instead of `/page-name.html` in your HTML files.
  
  Example:
  ```html
  <a href="/about/">About Us</a>
  ```

## 2. Configure Your Web Server

### For Apache (.htaccess)
Add this to your `.htaccess` file in the root directory:

```
RewriteEngine On
RewriteCond %{REQUEST_FILENAME}.html -f
RewriteRule ^([^/]+)/$ $1.html [L]
```

### For Node.js/Express
In your Express app, serve HTML files for clean URLs:

```js
app.get('/:page/', (req, res) => {
  res.sendFile(__dirname + '/public/' + req.params.page + '.html');
});
```

## 3. Test Your URLs
- Visit `/page-name/` in your browser. It should display the correct page without showing `.html` in the URL.

---

**Summary:**
- Use clean URLs in your links.
- Configure your server to map `/page-name/` to `page-name.html`.
- Avoid using `.html` in navigation and references.
