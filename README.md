# ESA Pages Template

A modern, beautiful website template built with Astro and TypeScript

## 🚀 Features

- **Modern Stack**: Built with Astro, TypeScript, and Tailwind CSS
- **Responsive**: Fully responsive design that works on all devices
- **Performance**: Optimized for speed with Astro's zero-JS by default approach
- **SEO Ready**: Built-in SEO optimization and meta tags
- **Accessible**: Following web accessibility best practices

## 🛠️ Tech Stack

- [Astro](https://astro.build/) - Static site generator
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Tailwind Typography](https://tailwindcss.com/docs/typography-plugin) - Beautiful typography

## 📦 Installation

1. Clone this repository:
```bash
git clone <your-repo-url>
cd esa-pages-template
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open your browser and visit `http://localhost:4321`

## 🏗️ Build

To build for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

## 📁 Project Structure

```
/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Hero.astro
│   │   ├── Features.astro
│   │   └── Footer.astro
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   └── index.astro
│   ├── styles/
│   │   └── global.css
│   └── env.d.ts
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```

## 🎨 Customization

### Colors
The template uses a custom color palette defined in `tailwind.config.mjs`. You can modify the colors to match your brand:

```js
colors: {
  primary: {
    // Your custom colors
  }
}
```

### Components
All components are located in `src/components/` and can be easily customized:

- **Header.astro**: Navigation and branding
- **Hero.astro**: Main hero section with call-to-action
- **Features.astro**: Feature showcase grid
- **Footer.astro**: Site footer with links and social media

### Layout
The base layout is in `src/layouts/BaseLayout.astro` and includes:

- Meta tags for SEO
- Open Graph tags for social sharing
- TypeScript support
- Global styles import

## 🚀 Deployment

This template can be deployed to any static hosting service:

- **Netlify**: Connect your Git repository for automatic deployments
- **Vercel**: Deploy with zero configuration
- **Cloudflare Pages**: Fast global deployment
- **GitHub Pages**: Free hosting for public repositories

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

