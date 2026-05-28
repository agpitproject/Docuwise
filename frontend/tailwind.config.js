/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['"DM Sans"', 'sans-serif'],
        serif: ['"DM Serif Display"', 'serif'],
      },
      colors: {
        bg:      '#F7F6F2',
        surface: '#FFFFFF',
        surface2:'#F0EFE9',
        surface3:'#E8E6DE',
        ink:     '#1A1916',
        muted:   '#7A7870',
        accent: {
          DEFAULT: '#2563EB',
          dark:    '#1D4ED8',
          light:   '#EFF4FF',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '14px',
        xl: '20px',
        '2xl': '24px',
      },
    },
  },
  plugins: [],
};
