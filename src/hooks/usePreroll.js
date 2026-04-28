import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function usePreroll() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadVideos() }, [])

  async function loadVideos() {
    try {
      const { data } = await supabase
        .from('preroll_videos')
        .select('id, titulo, video_url, duracion, activo, orden')
        .eq('activo', true)
        .order('orden', { ascending: true })
      setVideos(data || [])
    } catch {
      setVideos([])
    } finally {
      setLoading(false)
    }
  }

  function getRandomVideo() {
    if (videos.length === 0) return null
    return videos[Math.floor(Math.random() * videos.length)]
  }

  return { videos, loading, getRandomVideo, reload: loadVideos }
}
