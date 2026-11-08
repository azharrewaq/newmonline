import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'monline';

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  if (!MONGODB_URI) throw new Error('MONGODB_URI environment variable is not set');
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  cachedDb = client.db(DB_NAME);
  return cachedDb;
}

function tryObjectId(id) {
  try {
    if (id && id.length === 24 && /^[a-fA-F0-9]{24}$/.test(id)) {
      return new ObjectId(id);
    }
  } catch {}
  return null;
}

function buildIdQuery(rawId) {
  const id = decodeURIComponent(String(rawId || ''));
  const orConditions = [
    { id: id },
    { _id: id },
    { username: id },
    { national_id: id },
    { passport_no: id },
  ];
  const objId = tryObjectId(id);
  if (objId) {
    orConditions.unshift({ _id: objId });
  }
  const numId = Number(id);
  if (!Number.isNaN(numId) && id.trim() !== '') {
    orConditions.push({ id: numId });
  }
  return { $or: orConditions };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Parse path directly from req.url for reliability across all Vercel versions
    // req.url example: /api/users  or  /api/users/123  or  /api/users/bulk-import
    const rawPath = req.url.split('?')[0]; // Remove query string
    const segments = rawPath.split('/').filter(Boolean);
    // segments: ['api', 'users'] or ['api', 'users', '123'] or ['api', 'users', 'bulk-import']
    // segments[0] = 'api', segments[1] = collection, segments[2] = id or special

    const collectionName = segments[1];
    const segment2 = segments[2];

    // Debug info (remove after confirming it works)
    console.log('URL:', req.url, '| collection:', collectionName, '| segment2:', segment2, '| method:', req.method);

    if (!collectionName) {
      return res.status(400).json({ message: 'Collection name is required', url: req.url, segments });
    }

    const db = await connectToDatabase();
    const col = db.collection(collectionName);

    // ── POST /api/:collection/bulk-import ──────────────────────────────────────
    if (req.method === 'POST' && segment2 === 'bulk-import') {
      const body = req.body || {};
      const data =
        body.items || body.users || body.managers || body.coordinators ||
        body.mohfezs || body.students || body.branches || body.sessions ||
        body.rowaqs || body.applicants || body.reports || body.data || [];

      if (!Array.isArray(data) || data.length === 0) {
        return res.status(200).json({ inserted: 0 });
      }
      const result = await col.insertMany(data);
      return res.status(201).json({ inserted: result.insertedCount });
    }

    // ── POST /api/:collection/reschedule-day9 ─────────────────────────────────
    if (req.method === 'POST' && segment2 === 'reschedule-day9') {
      // 1. تطبيع جميع أرقام إكسيل التسلسلية القديمة في قاعدة البيانات إلى صيغة YYYY-MM-DD
      const serialEntries = [
        ['46336', '2026-11-10'],
        ['46337', '2026-11-11'],
        ['46338', '2026-11-12'],
        ['46339', '2026-11-13'],
        ['46340', '2026-11-14'],
      ];
      for (const [serialStr, normDate] of serialEntries) {
        const serialNum = Number(serialStr);
        await col.updateMany(
          { exam_date: { $in: [serialStr, serialNum] } },
          { $set: { exam_date: normDate } }
        );
      }

      // 2. ترحيل دارسي يوم 9 نوفمبر إلى ما بعد اليوم الأخير لكل مجموعة
      const day9Query = { exam_date: { $in: ['46335', 46335, '2026-11-09', '2026/11/09'] } };

      // أ) المجموعات التي تنتهي 13 نوفمبر -> ترحيل يوم 9 إلى 14 نوفمبر
      // المجموعات 1 و 2، والمجموعات من 31 إلى 40
      const g14 = [1, 2, ...Array.from({ length: 10 }, (_, i) => 31 + i)];
      const g14All = [...g14, ...g14.map(String)];
      const res14 = await col.updateMany(
        { ...day9Query, group_no: { $in: g14All } },
        { $set: { exam_date: '2026-11-14' } }
      );

      // ب) المجموعات التي تنتهي 12 نوفمبر -> ترحيل يوم 9 إلى 13 نوفمبر
      // المجموعات 3 و 4 و 5، والمجموعات من 11 إلى 20
      const g13 = [3, 4, 5, ...Array.from({ length: 10 }, (_, i) => 11 + i)];
      const g13All = [...g13, ...g13.map(String)];
      const res13 = await col.updateMany(
        { ...day9Query, group_no: { $in: g13All } },
        { $set: { exam_date: '2026-11-13' } }
      );

      // ج) المجموعات التي تمتد حتى 14 ومجموعات الكبار 21 و 22 -> ترحيل يوم 9 إلى 15 نوفمبر
      // المجموعات من 6 إلى 10، ومجموعتي 21 و 22
      const g15 = [6, 7, 8, 9, 10, 21, 22];
      const g15All = [...g15, ...g15.map(String)];
      const res15 = await col.updateMany(
        { ...day9Query, group_no: { $in: g15All } },
        { $set: { exam_date: '2026-11-15' } }
      );

      // د) أي دارس متبقي على يوم 9 بدون مجموعة محددة -> ترحيل إلى 14 نوفمبر
      const resRemaining = await col.updateMany(
        day9Query,
        { $set: { exam_date: '2026-11-14' } }
      );

      return res.status(200).json({
        success: true,
        message: 'تم ترحيل دارسي يوم 9 نوفمبر بنجاح لما بعد اليوم الأخير لكل مجموعة',
        movedTo13: res13.modifiedCount,
        movedTo14: res14.modifiedCount + resRemaining.modifiedCount,
        movedTo15: res15.modifiedCount,
        totalRescheduled: res13.modifiedCount + res14.modifiedCount + res15.modifiedCount + resRemaining.modifiedCount
      });
    }

    // ── DELETE /api/:collection/all ────────────────────────────────────────────
    if (req.method === 'DELETE' && segment2 === 'all') {
      const result = await col.deleteMany({});
      return res.status(200).json({ deleted: result.deletedCount });
    }

    // ── GET /api/:collection ───────────────────────────────────────────────────
    if (req.method === 'GET' && !segment2) {
      const docs = await col.find({}).toArray();
      return res.status(200).json(docs);
    }

    // ── POST /api/:collection ──────────────────────────────────────────────────
    if (req.method === 'POST' && !segment2) {
      const doc = req.body || {};
      const result = await col.insertOne(doc);
      return res.status(201).json({ ...doc, _id: result.insertedId });
    }

    // ── GET /api/:collection/:id ───────────────────────────────────────────────
    if (req.method === 'GET' && segment2) {
      const doc = await col.findOne(buildIdQuery(segment2));
      if (!doc) return res.status(200).json(null);
      return res.status(200).json(doc);
    }

    // ── PUT /api/:collection/:id ───────────────────────────────────────────────
    if (req.method === 'PUT' && segment2) {
      const updateData = req.body || {};
      const { _id, ...safeUpdate } = updateData;

      // أولاً: تحقق من وجود الوثيقة قبل الـ upsert لتفادي إنشاء سجلات مكررة
      const existingDoc = await col.findOne(buildIdQuery(segment2));

      if (existingDoc) {
        // الوثيقة موجودة — حدِّثها مباشرة بالـ _id الفعلي لضمان تحديث نفس السجل
        const result = await col.updateOne(
          { _id: existingDoc._id },
          { $set: safeUpdate }
        );
        return res.status(200).json({
          message: 'Updated',
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount,
          upsertedId: null
        });
      } else {
        // الوثيقة غير موجودة — أنشئها
        const newDoc = { ...safeUpdate };
        const result = await col.insertOne(newDoc);
        return res.status(200).json({
          message: 'Created',
          modifiedCount: 0,
          matchedCount: 0,
          upsertedId: result.insertedId
        });
      }
    }

    // ── DELETE /api/:collection/:id ────────────────────────────────────────────
    if (req.method === 'DELETE' && segment2) {
      const result = await col.deleteMany(buildIdQuery(segment2));
      if (result.deletedCount === 0) {
        return res.status(200).json({ message: 'Not found', deletedCount: 0 });
      }
      return res.status(200).json({ message: 'Deleted successfully', deletedCount: result.deletedCount });
    }

    return res.status(405).json({ message: 'Method not allowed' });

  } catch (error) {
    console.error('API Handler Error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
