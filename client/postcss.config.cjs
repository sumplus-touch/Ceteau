// PostCSS pipeline for the Vite dev/build process.
//
//   tailwindcss → expands @tailwind base/components/utilities directives
//                 in global.css and tree-shakes unused utilities at
//                 build time based on tailwind.config.js `content` paths.
//   autoprefixer → adds vendor prefixes for older browsers based on
//                  the browserslist defaults.
//
// Vite auto-detects this file when it sits at the package root. No
// import or plugin registration is needed in vite.config.ts.
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
