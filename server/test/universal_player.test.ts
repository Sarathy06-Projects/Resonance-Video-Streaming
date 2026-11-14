import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { app } from '../src/index';
import { query } from '../src/db';
import { resolveMediaUrl } from '../src/utils/resolver';

describe('Resonance Universal Video Link Support & Playback Engine Test Suite', () => {
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
  // 1. UNIVERSAL SOURCE RESOLVER: CATEGORIES A, B, C, D, E
  // =========================================================================
  describe('Universal Source Resolver & Classification', () => {
    test('Category A: Direct MP4, WebM, and OGG media files', async () => {
      // MP4
      const mp4Url = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      const resMp4 = await resolveMediaUrl(mp4Url);
      assert.strictEqual(resMp4.provider, 'direct');
      assert.strictEqual(resMp4.format, 'mp4');
      assert.strictEqual(resMp4.compatibility, 'fully_syncable');
      assert.strictEqual(resMp4.playbackMode, 'player');
      assert.strictEqual(resMp4.capabilities.canSeek, true);
      assert.strictEqual(resMp4.capabilities.canSyncRate, true);

      // WebM
      const resWebm = await resolveMediaUrl('https://example.com/videos/sample.webm');
      assert.strictEqual(resWebm.provider, 'direct');
      assert.strictEqual(resWebm.format, 'webm');
      assert.strictEqual(resWebm.compatibility, 'fully_syncable');

      // OGG
      const resOgg = await resolveMediaUrl('https://example.com/videos/trailer.ogg');
      assert.strictEqual(resOgg.provider, 'direct');
      assert.strictEqual(resOgg.format, 'ogg');
      assert.strictEqual(resOgg.compatibility, 'fully_syncable');
    });

    test('Category B: Streaming media (HLS .m3u8, MPEG-DASH .mpd)', async () => {
      // HLS
      const hlsUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
      const resHls = await resolveMediaUrl(hlsUrl);
      assert.strictEqual(resHls.provider, 'hls');
      assert.strictEqual(resHls.compatibility, 'fully_syncable');
      assert.strictEqual(resHls.playbackMode, 'player');
      assert.strictEqual(resHls.capabilities.canSeek, true);

      // DASH
      const dashUrl = 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd';
      const resDash = await resolveMediaUrl(dashUrl);
      assert.strictEqual(resDash.provider, 'dash');
      assert.strictEqual(resDash.compatibility, 'fully_syncable');
      assert.strictEqual(resDash.playbackMode, 'player');
      assert.strictEqual(resDash.capabilities.canSeek, true);
    });

    test('Category C: Known video platforms (YouTube, Vimeo, Dailymotion, Twitch, Streamable, Loom, Wistia)', async () => {
      // YouTube
      const resYt = await resolveMediaUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
      assert.strictEqual(resYt.provider, 'youtube');
      assert.strictEqual(resYt.compatibility, 'fully_syncable');
      assert.strictEqual(resYt.capabilities.canSeek, true);

      // Vimeo
      const resVimeo = await resolveMediaUrl('https://vimeo.com/76979871');
      assert.strictEqual(resVimeo.provider, 'vimeo');
      assert.strictEqual(resVimeo.compatibility, 'fully_syncable');

      // Dailymotion
      const resDm = await resolveMediaUrl('https://www.dailymotion.com/video/x8n6f4s');
      assert.strictEqual(resDm.provider, 'dailymotion');
      assert.strictEqual(resDm.compatibility, 'fully_syncable');

      // Twitch VOD
      const resTwVod = await resolveMediaUrl('https://www.twitch.tv/videos/1234567890');
      assert.strictEqual(resTwVod.provider, 'twitch');
      assert.strictEqual(resTwVod.compatibility, 'fully_syncable');
      assert.strictEqual(resTwVod.capabilities.canSeek, true);

      // Twitch Live Channel
      const resTwLive = await resolveMediaUrl('https://www.twitch.tv/riotgames');
      assert.strictEqual(resTwLive.provider, 'twitch');
      assert.strictEqual(resTwLive.compatibility, 'limited_sync');
      assert.strictEqual(resTwLive.capabilities.canSeek, false);
      assert.strictEqual(resTwLive.capabilities.isLive, true);

      // Streamable
      const resStreamable = await resolveMediaUrl('https://streamable.com/moo123');
      assert.strictEqual(resStreamable.provider, 'streamable');
      assert.strictEqual(resStreamable.compatibility, 'fully_syncable');
      assert.strictEqual(resStreamable.playbackMode, 'embed');

      // Loom
      const resLoom = await resolveMediaUrl('https://www.loom.com/share/abcdef123456');
      assert.strictEqual(resLoom.provider, 'loom');
      assert.strictEqual(resLoom.compatibility, 'fully_syncable');
      assert.strictEqual(resLoom.playbackMode, 'embed');

      // Wistia
      const resWistia = await resolveMediaUrl('https://home.wistia.com/medias/abc12345');
      assert.strictEqual(resWistia.provider, 'wistia');
      assert.strictEqual(resWistia.compatibility, 'fully_syncable');
      assert.strictEqual(resWistia.playbackMode, 'embed');

      // Internet Archive
      const resArchive = await resolveMediaUrl('https://archive.org/details/ElectraGlideInBlue_1973');
      assert.strictEqual(resArchive.provider, 'generic_embed');
      assert.strictEqual(resArchive.compatibility, 'fully_syncable');
      assert.strictEqual(resArchive.playbackMode, 'embed');
    });

    test('Category D: Generic video webpage with unknown domain is accepted', async () => {
      // The system must NOT reject URLs simply because the domain is unknown!
      const unknownWebUrl = 'https://mit-opencourseware.edu/courses/video-lecture-3';
      const resGeneric = await resolveMediaUrl(unknownWebUrl);
      assert.strictEqual(resGeneric.provider, 'generic_embed');
      assert.strictEqual(resGeneric.compatibility, 'limited_sync');
      assert.strictEqual(resGeneric.playbackMode, 'embed');
      assert.strictEqual(resGeneric.supported, true);
      assert.ok(resGeneric.explanation.includes('mit-opencourseware.edu'));
    });

    test('Category E: Restricted sources (DRM & Blocked Embedding) switch to External Playback', async () => {
      // Netflix (Widevine DRM + X-Frame-Options: DENY)
      const resNetflix = await resolveMediaUrl('https://www.netflix.com/title/80057281');
      assert.strictEqual(resNetflix.provider, 'external');
      assert.strictEqual(resNetflix.compatibility, 'embedding_blocked');
      assert.strictEqual(resNetflix.playbackMode, 'external');
      assert.strictEqual(resNetflix.supported, true);
      assert.ok(resNetflix.explanation.includes('DRM'));

      // Amazon Prime Video
      const resPrime = await resolveMediaUrl('https://www.primevideo.com/detail/0S35G0J');
      assert.strictEqual(resPrime.provider, 'external');
      assert.strictEqual(resPrime.compatibility, 'embedding_blocked');
      assert.strictEqual(resPrime.playbackMode, 'external');

      // Disney+
      const resDisney = await resolveMediaUrl('https://www.disneyplus.com/video/12345');
      assert.strictEqual(resDisney.provider, 'external');
      assert.strictEqual(resDisney.compatibility, 'embedding_blocked');
      assert.strictEqual(resDisney.playbackMode, 'external');

      // Hulu
      const resHulu = await resolveMediaUrl('https://www.hulu.com/watch/67890');
      assert.strictEqual(resHulu.provider, 'external');
      assert.strictEqual(resHulu.compatibility, 'embedding_blocked');
      assert.strictEqual(resHulu.playbackMode, 'external');

      // TikTok (Frame Restricted via X-Frame-Options / CSP frame-ancestors)
      const resTikTok = await resolveMediaUrl('https://www.tiktok.com/@creator/video/7123456789012345678');
      assert.strictEqual(resTikTok.provider, 'external');
      assert.strictEqual(resTikTok.compatibility, 'embedding_blocked');
      assert.strictEqual(resTikTok.playbackMode, 'external');
      assert.strictEqual(resTikTok.supported, true);
      assert.strictEqual(resTikTok.capabilities.canSeek, false);
      assert.strictEqual(resTikTok.capabilities.canPause, true);
      assert.ok(resTikTok.explanation.includes('X-Frame-Options') || resTikTok.explanation.includes('SAMEORIGIN') || resTikTok.explanation.includes('CSP'));

      // Social / Restricted video platform (Instagram)
      const resInstagram = await resolveMediaUrl('https://www.instagram.com/reel/Cq123456789/');
      assert.strictEqual(resInstagram.provider, 'external');
      assert.strictEqual(resInstagram.compatibility, 'embedding_blocked');
      assert.strictEqual(resInstagram.playbackMode, 'external');
    });

    test('Category F: Authentication-dependent content switches to External Playback', async () => {
      const resPatreon = await resolveMediaUrl('https://www.patreon.com/posts/secret-video-12345');
      assert.strictEqual(resPatreon.provider, 'external');
      assert.strictEqual(resPatreon.compatibility, 'auth_required');
      assert.strictEqual(resPatreon.playbackMode, 'external');
    });
  });

  // =========================================================================
  // 2. SECURITY & SSRF PROTECTION
  // =========================================================================
  describe('Security & SSRF Defense', () => {
    test('Rejects dangerous URI schemes (file:, javascript:, data:, blob:, ftp:)', async () => {
      await assert.rejects(
        () => resolveMediaUrl('file:///etc/passwd'),
        /secure HTTP and HTTPS/i
      );
      await assert.rejects(
        () => resolveMediaUrl('javascript:alert(1)'),
        /secure HTTP and HTTPS/i
      );
      await assert.rejects(
        () => resolveMediaUrl('data:text/html,<script>alert(1)</script>'),
        /secure HTTP and HTTPS/i
      );
      await assert.rejects(
        () => resolveMediaUrl('ftp://ftp.example.com/video.mp4'),
        /secure HTTP and HTTPS/i
      );
    });

    test('Rejects internal loopback and private RFC 1918 subnets', async () => {
      await assert.rejects(
        () => resolveMediaUrl('https://127.0.0.1/video.mp4'),
        /restricted|private/i
      );
      await assert.rejects(
        () => resolveMediaUrl('https://[::1]/video.mp4'),
        /restricted|private/i
      );
      await assert.rejects(
        () => resolveMediaUrl('https://10.0.0.1/video.mp4'),
        /restricted|private/i
      );
      await assert.rejects(
        () => resolveMediaUrl('https://192.168.1.1/video.mp4'),
        /restricted|private/i
      );
      await assert.rejects(
        () => resolveMediaUrl('https://172.16.0.1/video.mp4'),
        /restricted|private/i
      );
    });

    test('Rejects cloud metadata endpoints (169.254.169.254)', async () => {
      await assert.rejects(
        () => resolveMediaUrl('https://169.254.169.254/latest/meta-data'),
        /restricted|private/i
      );
    });
  });

  // =========================================================================
  // 3. API INTEGRATION & MULTI-CATEGORY ROOM LIFECYCLE
  // =========================================================================
  describe('API Endpoints & Room Creation Across Categories', () => {
    test('POST /api/rooms/validate-url returns rich compatibility classification', async () => {
      // Test 1: Direct MP4
      const resMp4 = await fetch(`${baseUrl}/api/rooms/validate-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' }),
      });
      const dataMp4 = await resMp4.json();
      assert.strictEqual(resMp4.status, 200);
      assert.strictEqual(dataMp4.valid, true);
      assert.strictEqual(dataMp4.compatibility, 'fully_syncable');
      assert.strictEqual(dataMp4.playbackMode, 'player');

      // Test 2: Generic Unknown Domain
      const resGen = await fetch(`${baseUrl}/api/rooms/validate-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://ocw.mit.edu/courses/video-lecture' }),
      });
      const dataGen = await resGen.json();
      assert.strictEqual(resGen.status, 200);
      assert.strictEqual(dataGen.valid, true);
      assert.strictEqual(dataGen.provider, 'generic_embed');
      assert.strictEqual(dataGen.compatibility, 'limited_sync');

      // Test 3: DRM Protected / Blocked Embedding
      const resDrm = await fetch(`${baseUrl}/api/rooms/validate-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://www.netflix.com/title/80057281' }),
      });
      const dataDrm = await resDrm.json();
      assert.strictEqual(resDrm.status, 200);
      assert.strictEqual(dataDrm.valid, true);
      assert.strictEqual(dataDrm.compatibility, 'embedding_blocked');
      assert.strictEqual(dataDrm.playbackMode, 'external');
    });

    test('POST /api/rooms creates room with generic webpage URL', async () => {
      const genericUrl = 'https://ocw.mit.edu/courses/physics-lecture-1';
      const res = await fetch(`${baseUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: genericUrl,
          hostName: 'Professor Host',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.metadata.videoProvider, 'generic_embed');
      assert.strictEqual(data.metadata.videoId, genericUrl);

      // Clean up created room
      await query('DELETE FROM room_members WHERE room_id = $1', [data.roomId]);
      await query('DELETE FROM rooms WHERE id = $1', [data.roomId]);
    });

    test('POST /api/rooms creates room with DRM external URL (Netflix)', async () => {
      const netflixUrl = 'https://www.netflix.com/title/80057281';
      const res = await fetch(`${baseUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: netflixUrl,
          hostName: 'Movie Night Host',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.metadata.videoProvider, 'external');
      assert.strictEqual(data.metadata.videoId, netflixUrl);

      // Clean up created room
      await query('DELETE FROM room_members WHERE room_id = $1', [data.roomId]);
      await query('DELETE FROM rooms WHERE id = $1', [data.roomId]);
    });

    test('POST /api/rooms/:id/video switches video to DRM external mode and persists provider', async () => {
      const primeUrl = 'https://www.primevideo.com/detail/0S35G0J';
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: hostToken,
          videoUrl: primeUrl,
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.provider, 'external');

      // Verify in Neon DB
      const dbRes = await query('SELECT video_provider, video_id FROM rooms WHERE id = $1', [testRoomId]);
      assert.strictEqual(dbRes.rows[0].video_provider, 'external');
      assert.strictEqual(dbRes.rows[0].video_id, primeUrl);
    });
  });
});
