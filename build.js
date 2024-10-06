const fs = require('fs');
const path = require('path');

// Define source and destination directories
const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');
const componentsDir = path.join(srcDir, 'components');

// Helper function to read the contents of a file
const readFile = (filePath) => {
  return fs.promises.readFile(filePath, 'utf-8');
};

// Helper function to write contents to a file
const writeFile = (filePath, content) => {
  return fs.promises.writeFile(filePath, content);
};

// Function to format HTML content
const formatHTML = (htmlContent) => {
  // Remove unnecessary newlines and spaces
  return htmlContent
    .replace(/\n\s+/g, '\n') // Remove leading spaces
    .replace(/\n+/g, '\n') // Remove multiple newlines
    .replace(/\s{2,}/g, ' ') // Remove extra spaces
    .trim(); // Trim leading and trailing spaces
};

// Copy the HTML files from src to dist and replace custom components
const buildHTMLFiles = async () => {
  try {
    // Ensure the dist directory exists
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir);
    }

    // Get all .html files in the src directory (non-recursive)
    const files = fs.readdirSync(srcDir).filter((file) => file.endsWith('.html'));

    // Process each HTML file
    for (const file of files) {
      const filePath = path.join(srcDir, file);
      let htmlContent = await readFile(filePath);

      // Search for custom elements (assuming they match lowercase component filenames)
      const customElements = htmlContent.match(/<([a-z]+)>/g);

      if (customElements) {
        for (const element of customElements) {
          // Extract the tag name (e.g., 'footer' from '<footer>')
          const tagName = element.replace(/[<>]/g, '');

          // Check if there's a corresponding component file
          const componentFile = path.join(componentsDir, `${tagName}.html`);

          if (fs.existsSync(componentFile)) {
            let componentContent = await readFile(componentFile);

            // Optional: Format or minify the component content
            componentContent = formatHTML(componentContent);

            // Replace the custom element in the HTML with the formatted component content
            const regex = new RegExp(`<${tagName}>.*?<\\/${tagName}>`, 'gs');
            htmlContent = htmlContent.replace(regex, componentContent);
          }
        }
      }

      // Write the processed HTML file to the dist directory
      const destPath = path.join(distDir, file);
      await writeFile(destPath, htmlContent);
      console.log(`Processed and copied: ${file}`);
    }

    console.log('Build completed successfully.');
  } catch (error) {
    console.error('Error during build:', error);
  }
};

// Run the build
buildHTMLFiles();
