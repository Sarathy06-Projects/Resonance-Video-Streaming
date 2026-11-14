import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { app } from '../src/index';
import { query } from '../src/db';
import { resolveMediaUrl } from '../src/utils/resolver';

describe('Resonance Universal Video Playback Engine Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let testRoomId: string;
  let hostToken: string;

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });

    // Create a base room
    const roomRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        hostName: 'Host Universal',
      }),
    });
    const roomData = await roomRes.json();
    assert.strictEqual(roomRes.status, 201);
    testRoomId = roomData.roomId;
    hostToken = roomData.token;
  });

  after(async () => {
    try {
      if (testRoomId) {
        await query('DELETE FROM room_messages WHERE room_id = $1', [testRoomId]);
        await query('DELETE FROM room_members WHERE room_id = $1', [testRoomId]);
        await query('DELETE FROM rooms WHERE id = $1', [testRoomId]);
      }
    } catch {}
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setTimeout(() => process.exit(0), 100);
  });

  // =========================================================================
  // 1. PROVIDER IDENTIFICATION & RESOLUTION (ALL 7 PROVIDERS)
  // =========================================================================
  describe('Provider Identification & URL Normalization', () => {
    test('1. YouTube: Resolves standard watch URL, shorts, and youtu.be', async () => {
      const res1 = await resolveMediaUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
      assert.strictEqual(res1.provider, 'youtube');
      assert.strictEqual(res1.videoId, 'aqz-KE-bpKQ');
      assert.strictEqual(res1.capabilities.canSeek, true);

      const res2 = await resolveMediaUrl('https://youtu.be/aqz-KE-bpKQ');
      assert.strictEqual(res2.provider, 'youtube');
      assert.strictEqual(res2.videoId, 'aqz-KE-bpKQ');

      const res3 = await resolveMediaUrl('https://www.youtube.com/shorts/aqz-KE-bpKQ');
      assert.strictEqual(res3.provider, 'youtube');
      assert.strictEqual(res3.videoId, 'aqz-KE-bpKQ');
    });

    test('2. Direct MP4 & WebM: Resolves native HTML5 video URLs', async () => {
      const mp4Url = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      const resMp4 = await resolveMediaUrl(mp4Url);
      assert.strictEqual(resMp4.provider, 'direct');
      assert.strictEqual(resMp4.format, 'mp4');
      assert.strictEqual(resMp4.capabilities.canSeek, true);
      assert.strictEqual(resMp4.capabilities.canSyncRate, true);

      const webmUrl = 'https://example.com/videos/sample_nature.webm';
      const resWebm = await resolveMediaUrl(webmUrl);
      assert.strictEqual(resWebm.provider, 'direct');
      assert.strictEqual(resWebm.format, 'webm');
    });

    test('3. HLS (.m3u8): Resolves adaptive HTTP Live Streaming manifests', async () => {
      const hlsUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
      const resHls = await resolveMediaUrl(hlsUrl);
      assert.strictEqual(resHls.provider, 'hls');
      assert.strictEqual(resHls.format, 'hls');
      assert.strictEqual(resHls.capabilities.canSeek, true);
    });

    test('4. Vimeo: Resolves numeric Vimeo IDs and embeds', async () => {
      const vimeoUrl = 'https://vimeo.com/76979871';
      const resVimeo = await resolveMediaUrl(vimeoUrl);
      assert.strictEqual(resVimeo.provider, 'vimeo');
      assert.strictEqual(resVimeo.videoId, '76979871');
      assert.strictEqual(resVimeo.capabilities.canSeek, true);
      assert.strictEqual(resVimeo.capabilities.canSyncRate, true);
    });

    test('5. Dailymotion: Resolves Dailymotion video URLs and shortlinks', async () => {
      const dmUrl = 'https://www.dailymotion.com/video/x8n6f4s';
      const resDm = await resolveMediaUrl(dmUrl);
      assert.strictEqual(resDm.provider, 'dailymotion');
      assert.strictEqual(resDm.videoId, 'x8n6f4s');
      assert.strictEqual(resDm.capabilities.canSeek, true);

      const dmShort = 'https://dai.ly/x8n6f4s';
      const resDmShort = await resolveMediaUrl(dmShort);
      assert.strictEqual(resDmShort.provider, 'dailymotion');
      assert.strictEqual(resDmShort.videoId, 'x8n6f4s');
    });

    test('6. DASH (.mpd): Resolves MPEG-DASH manifests', async () => {
      const dashUrl = 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd';
      const resDash = await resolveMediaUrl(dashUrl);
      assert.strictEqual(resDash.provider, 'dash');
      assert.strictEqual(resDash.format, 'dash');
      assert.strictEqual(resDash.capabilities.canSeek, true);
    });

    test('7. Twitch: Resolves VODs (with seek) and Live Channels (live sync)', async () => {
      // Twitch VOD
      const vodUrl = 'https://www.twitch.tv/videos/1234567890';
      const resVod = await resolveMediaUrl(vodUrl);
      assert.strictEqual(resVod.provider, 'twitch');
      assert.strictEqual(resVod.videoId, '1234567890');
      assert.strictEqual(resVod.capabilities.canSeek, true);
      assert.strictEqual(resVod.capabilities.isLive, false);

      // Twitch Live Channel
      const liveUrl = 'https://www.twitch.tv/riotgames';
      const resLive = await resolveMediaUrl(liveUrl);
      assert.strictEqual(resLive.provider, 'twitch');
      assert.strictEqual(resLive.videoId, 'riotgames');
      assert.strictEqual(resLive.capabilities.canSeek, false);
      assert.strictEqual(resLive.capabilities.isLive, true);
    });
  });

  // =========================================================================
  // 2. SECURITY & SSRF PROTECTION
  // =========================================================================
  describe('Security & SSRF Defense', () => {
    test('Rejects localhost and loopback addresses', async () => {
      await assert.rejects(
        () => resolveMediaUrl('http://localhost:8080/video.mp4'),
        /restricted|format/i
      );
      await assert.rejects(
        () => resolveMediaUrl('https://127.0.0.1/video.mp4'),
        /restricted|private/i
      );
      await assert.rejects(
        () => resolveMediaUrl('https://[::1]/video.mp4'),
        /restricted|private/i
      );
    });

    test('Rejects cloud metadata endpoints (169.254.169.254)', async () => {
      await assert.rejects(
        () => resolveMediaUrl('https://169.254.169.254/latest/meta-data'),
        /restricted|private/i
      );
    });

    test('Rejects RFC 1918 private IP ranges (10.x, 192.168.x, 172.16-31.x)', async () => {
      await assert.rejects(
        () => resolveMediaUrl('https://10.0.0.5/stream.m3u8'),
        /restricted|private/i
      );
      await assert.rejects(
        () => resolveMediaUrl('https://192.168.1.100/video.mp4'),
        /restricted|private/i
      );
      await assert.rejects(
        () => resolveMediaUrl('https://172.20.5.1/video.mp4'),
        /restricted|private/i
      );
    });

    test('Rejects non-HTTP(S) URI schemes (file://, javascript:, data:)', async () => {
      await assert.rejects(
        () => resolveMediaUrl('file:///etc/passwd'),
        /secure HTTPS/i
      );
      await assert.rejects(
        () => resolveMediaUrl('javascript:alert(1)'),
        /secure HTTPS/i
      );
    });
  });

  // =========================================================================
  // 3. API ENDPOINTS & MULTI-PROVIDER LIFECYCLE
  // =========================================================================
  describe('Multi-Provider API Integration', () => {
    test('POST /api/rooms/validate-url returns provider and capabilities', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/validate-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://vimeo.com/76979871' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.valid, true);
      assert.strictEqual(data.provider, 'vimeo');
      assert.strictEqual(data.videoId, '76979871');
      assert.strictEqual(data.capabilities.canSeek, true);
    });

    test('GET /api/rooms/curated/demos returns demos across multiple providers', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/curated/demos`);
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(data.demos));
      assert.ok(data.demos.length >= 6);

      const providers = data.demos.map((d: any) => d.provider);
      assert.ok(providers.includes('youtube'));
      assert.ok(providers.includes('direct'));
      assert.ok(providers.includes('hls'));
      assert.ok(providers.includes('vimeo'));
      assert.ok(providers.includes('dailymotion'));
      assert.ok(providers.includes('dash'));
    });

    test('POST /api/rooms creates room with Direct MP4 URL', async () => {
      const mp4Url = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      const res = await fetch(`${baseUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: mp4Url,
          hostName: 'MP4 Host',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.metadata.videoProvider, 'direct');
      assert.strictEqual(data.metadata.videoId, mp4Url);

      // Clean up created room
      await query('DELETE FROM room_members WHERE room_id = $1', [data.roomId]);
      await query('DELETE FROM rooms WHERE id = $1', [data.roomId]);
    });

    test('POST /api/rooms/:id/video updates playing video to HLS stream and persists provider', async () => {
      const hlsUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: hostToken,
          videoUrl: hlsUrl,
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.provider, 'hls');

      // Verify in Neon DB
      const dbRes = await query('SELECT video_provider, video_id FROM rooms WHERE id = $1', [testRoomId]);
      assert.strictEqual(dbRes.rows[0].video_provider, 'hls');
      assert.strictEqual(dbRes.rows[0].video_id, hlsUrl);
    });
  });
});
