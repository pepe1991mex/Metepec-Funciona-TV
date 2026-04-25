import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FALLBACK_CHANNELS } from '../data/channels'

export function useChannels() {
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChannels()
  }, [])

  async function loadChannels() {
    try {
      const { data, error } = await supabase
        .from('canales')
        .select('id, nombre, slug, url_hls, logo_url, categoria, orden, activo')
        .eq('activo', true)
        .order('orden', { ascending: true })

      if (error) throw error
      if (data && data.length > 0) {
        console.log('Canales from Supabase:', data.length)
        setChannels(data)
      } else {
        console.log('No channels in Supabase, using fallback')
        setChannels(FALLBACK_CHANNELS)
      }
    } catch (err) {
      console.error('Error loading channels:', err)
      setChannels(FALLBACK_CHANNELS)
    } finally {
      setLoading(false)
    }
  }

  return { channels, loading, reload: loadChannels }
}