import { useState, useEffect, useCallback, useRef } from "react";

var SUPABASE_URL = "https://wwoifdrnllhxptmbkxvp.supabase.co";
var FUNCTION_URL = SUPABASE_URL + "/functions/v1/generate-stream-token";
var ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3b2lmZHJubGxoeHB0bWJreHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDc1MzEsImV4cCI6MjA5MjU4MzUzMX0.luIJDQXXg13r-8KM2fFaK8raLd350NEhKlh-nQELrc0";
var RENEWAL_BUFFER_MS = 5 * 60 * 1000;
var MIN_RETRY_MS = 30000;

export function useStreamToken(canal, usuarioId, sessionToken, streamUri) {
  var [tokenData, setTokenData] = useState(null);
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState(null);
  var renewalTimer = useRef(null);
  var fetchVersion = useRef(0);

  var fetchToken = useCallback(function () {
    if (!canal || !usuarioId || !sessionToken || !streamUri) return;

    var currentVersion = ++fetchVersion.current;
    setTokenData(null);
    setLoading(true);
    setError(null);

    fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + ANON_KEY,
      },
      body: JSON.stringify({
        usuario_id: usuarioId,
        session_token: sessionToken,
        canal: canal,
        uri: streamUri,
      }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (errBody) {
            throw new Error(errBody.error || "HTTP " + res.status);
          }).catch(function (e) {
            if (e.message) throw e;
            throw new Error("HTTP " + res.status);
          });
        }
        return res.json();
      })
      .then(function (data) {
        if (currentVersion !== fetchVersion.current) return;
        setTokenData(data);
        setLoading(false);

        if (renewalTimer.current) clearTimeout(renewalTimer.current);
        var msUntilExpiry = (data.expires * 1000) - Date.now();
        var renewIn = Math.max(msUntilExpiry - RENEWAL_BUFFER_MS, MIN_RETRY_MS);
        renewalTimer.current = setTimeout(function () {
          fetchToken();
        }, renewIn);
      })
      .catch(function (err) {
        if (currentVersion !== fetchVersion.current) return;
        setError(err.message);
        setLoading(false);
        console.error("[useStreamToken] Error:", err.message);
      });
  }, [canal, usuarioId, sessionToken, streamUri]);

  useEffect(function () {
    fetchToken();
    return function () {
      if (renewalTimer.current) clearTimeout(renewalTimer.current);
    };
  }, [fetchToken]);

  return {
    streamUrl: tokenData ? tokenData.url : null,
    expires: tokenData ? tokenData.expires : null,
    ttl: tokenData ? tokenData.ttl : null,
    loading: loading,
    error: error,
    refresh: fetchToken,
  };
}
