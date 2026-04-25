// Ads configuration — preroll & midroll via Cloudinary
// Replace URLs with actual municipal ad videos
export const adsConfig = {
  preroll: {
    enabled: false,
    videos: [
      // { url: 'https://res.cloudinary.com/xxx/video/upload/v1/metepec-ad1.mp4', duration: 15 },
    ],
  },
  midroll: {
    enabled: false,
    intervalMinutes: 15,
    videos: [],
  },
}