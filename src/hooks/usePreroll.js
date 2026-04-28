import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function usePreroll() {
  const [loading, setLoading] = useState(true)
  const [allVideos, setAllVideos] = useState([])
  const [prerollCanales, setPrerollCanales] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [{ data: videos }, { data: canales }] = await Promise.all([
        supabase.from('preroll_videos')
          .select('id, titulo, video_url, duracion, activo, orden')
          .eq('activo', true),
        supabase.from('preroll_canales')
          .select('preroll_id, canal_id')
          .eq('activo', true)
      ])
      setAllVideos(videos || [])
      setPrerollCanales(canales || [])
    } catch {
      setAllVideos([])
      setPrerollCanales([])
    } finally {
      setLoading(false)
    }
  }

  function getRandomVideo(canalId) {
    if (!canalId) return null
    const assignedIds = prerollCanales
      .filter(pc => pc.canal_id === canalId)
      .map(pc => pc.preroll_id)
    if (assignedIds.length === 0) return null
    const eligible = allVideos.filter(v => assignedIds.includes(v.id))
    if (eligible.length === 0) return null
    return eligible[Math.floor(Math.random() * eligible.length)]
  }

  return { loading, getRandomVideo, reload: load }
}
