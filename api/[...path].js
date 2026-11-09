import { MongoClient, ObjectId } from 'mongodb';
import zlib from 'zlib';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'monline';

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  if (!MONGODB_URI) throw new Error('MONGODB_URI environment variable is not set');
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 10000,
    family: 4,
    autoSelectFamily: false,
  });
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

function toEnglishDigits(str) {
  if (!str) return '';
  return String(str)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .trim();
}

function buildIdQuery(rawId) {
  const rawStr = decodeURIComponent(String(rawId || '')).trim();
  const id = toEnglishDigits(rawStr);
  const orConditions = [
    { id: id },
    { _id: id },
    { username: id },
    { national_id: id },
    { passport_no: id },
    { name: rawStr },
  ];
  if (rawStr && rawStr !== id) {
    orConditions.push({ national_id: rawStr });
    orConditions.push({ passport_no: rawStr });
    orConditions.push({ username: rawStr });
  }
  const objId = tryObjectId(id) || tryObjectId(rawStr);
  if (objId) {
    orConditions.unshift({ _id: objId });
  }
  const numId = Number(id);
  if (!Number.isNaN(numId) && id !== '') {
    orConditions.push({ id: numId });
    orConditions.push({ national_id: numId });
    orConditions.push({ passport_no: numId });
  }
  if (rawStr && !/^\d+$/.test(id)) {
    const escaped = rawStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    orConditions.push({ name: { $regex: new RegExp(`^${escaped}`, 'i') } });
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
    const urlObj = new URL(req.url, 'http://localhost');
    const batchParam = urlObj.searchParams.get('batch');
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

    // ── POST /api/:collection/split-group-times ──────────────────────────────
    if (req.method === 'POST' && segment2 === 'split-group-times') {
      const applicants = await col.find(
        { group_no: { $exists: true, $ne: null, $ne: '' } },
        { projection: { _id: 1, id: 1, group_no: 1, exam_date: 1 } }
      ).toArray();

      if (!applicants || applicants.length === 0) {
        return res.status(200).json({ success: true, updatedCount: 0, message: 'لا يوجد متقدمين مسكنين' });
      }

      const groupDateMap = new Map();
      for (const app of applicants) {
        const gNo = Number(app.group_no);
        if (isNaN(gNo) || gNo < 1 || gNo > 40) continue;
        const d = String(app.exam_date || '').trim();
        const key = `${gNo}||${d}`;
        if (!groupDateMap.has(key)) {
          groupDateMap.set(key, []);
        }
        groupDateMap.get(key).push(app);
      }

      const bulkOps = [];
      let totalAssigned = 0;

      for (const [key, appList] of groupDateMap.entries()) {
        // جميع المجموعات (من 1 إلى 40) مواعيدها من 6 إلى 8 مساءً مقسمة لـ 4 فترات
        const slots = ['18:00 - 18:30', '18:30 - 19:00', '19:00 - 19:30', '19:30 - 20:00'];

        const N = appList.length;
        const q = Math.floor(N / 4);
        const rem = N % 4;
        const slotCounts = [
          q + (rem > 0 ? 1 : 0),
          q + (rem > 1 ? 1 : 0),
          q + (rem > 2 ? 1 : 0),
          q,
        ];

        let curIdx = 0;
        for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
          const count = slotCounts[slotIdx];
          const timeVal = slots[slotIdx];
          for (let i = 0; i < count; i++) {
            if (curIdx >= N) break;
            const targetApp = appList[curIdx];
            bulkOps.push({
              updateOne: {
                filter: { _id: targetApp._id },
                update: { $set: { exam_time: timeVal } }
              }
            });
            curIdx++;
            totalAssigned++;
          }
        }
      }

      let modifiedCount = 0;
      if (bulkOps.length > 0) {
        for (let i = 0; i < bulkOps.length; i += 1000) {
          const chunk = bulkOps.slice(i, i + 1000);
          const result = await col.bulkWrite(chunk, { ordered: false });
          modifiedCount += result.modifiedCount || 0;
        }
      }

      return res.status(200).json({
        success: true,
        message: 'تم تقسيم مواعيد المجموعات إلى 4 فترات (نصف ساعة لكل ربع) بنجاح',
        totalApplicants: applicants.length,
        totalAssigned,
        modifiedCount,
      });
    }

    // ── DELETE /api/:collection/all ────────────────────────────────────────────
    if (req.method === 'DELETE' && segment2 === 'all') {
      const result = await col.deleteMany({});
      return res.status(200).json({ deleted: result.deletedCount });
    }

    // ── POST /api/:collection/set-all-times ──────────────────────────────────
    if (req.method === 'POST' && segment2 === 'set-all-times') {
      const result = await col.updateMany(
        {},
        {
          $set: {
            time_start: '17:30',
            time_end: '21:00',
            shift_label: 'من 05:30 م إلى 09:00 م'
          }
        }
      );
      return res.status(200).json({
        success: true,
        modifiedCount: result.modifiedCount,
        message: 'تم ضبط توقيت جميع المجموعات من 05:30 مساءً إلى 09:00 مساءً بنجاح'
      });
    }

    // ── GET /api/:collection/latest ───────────────────────────────────────────
    if (req.method === 'GET' && segment2 === 'latest') {
      const docs = await col.find({}).sort({ _id: -1 }).limit(25).toArray();
      return res.status(200).json(docs);
    }

    // ── GET /api/:collection/dedup-check ─────────────────────────────────────
    if (req.method === 'GET' && segment2 === 'dedup-check') {
      const totalDocs = await col.countDocuments({});
      const dupAgg = await col.aggregate([
        {
          $group: {
            _id: { $trim: { input: { $ifNull: ['$national_id', '$passport_no'] } } },
            count: { $sum: 1 },
            ids: { $push: '$_id' },
            names: { $push: '$name' },
            dates: { $push: '$exam_date' },
            groups: { $push: '$group_no' }
          }
        },
        { $match: { _id: { $ne: '', $ne: null }, count: { $gt: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();

      const totalDuplicatesCount = dupAgg.reduce((acc, d) => acc + (d.count - 1), 0);
      const distinctCount = totalDocs - totalDuplicatesCount;

      return res.status(200).json({
        totalDocs,
        totalDuplicatesCount,
        distinctCount,
        duplicatedKeysCount: dupAgg.length,
        sampleDuplicates: dupAgg.slice(0, 10).map(d => ({
          nid: d._id,
          count: d.count,
          names: Array.from(new Set(d.names)),
          dates: d.dates,
          groups: d.groups,
          ids: d.ids
        }))
      });
    }

    // ── POST /api/:collection/dedup-clean ────────────────────────────────────
    if (req.method === 'POST' && segment2 === 'dedup-clean') {
      const dupAgg = await col.aggregate([
        {
          $group: {
            _id: { $trim: { input: { $ifNull: ['$national_id', '$passport_no'] } } },
            count: { $sum: 1 },
            docs: { $push: { _id: '$_id', id: '$id', exam_date: '$exam_date', group_no: '$group_no' } }
          }
        },
        { $match: { _id: { $ne: '', $ne: null }, count: { $gt: 1 } } }
      ]).toArray();

      const idsToDelete = [];
      for (const item of dupAgg) {
        const sorted = item.docs.sort((a, b) => {
          const aHasDate = a.exam_date ? 1 : 0;
          const bHasDate = b.exam_date ? 1 : 0;
          if (aHasDate !== bHasDate) return bHasDate - aHasDate;
          return String(b._id).localeCompare(String(a._id));
        });
        for (let i = 1; i < sorted.length; i++) {
          idsToDelete.push(sorted[i]._id);
        }
      }

      let deletedCount = 0;
      if (idsToDelete.length > 0) {
        for (let i = 0; i < idsToDelete.length; i += 1000) {
          const chunk = idsToDelete.slice(i, i + 1000);
          const delRes = await col.deleteMany({ _id: { $in: chunk } });
          deletedCount += delRes.deletedCount || 0;
        }
      }

      const remainingCount = await col.countDocuments({});

      return res.status(200).json({
        success: true,
        deletedDuplicates: deletedCount,
        remainingCount,
        message: `تم إزالة ${deletedCount} سجل مكرر بنجاح، والعدد الإجمالي المتبقي: ${remainingCount}`
      });
    }

    // ── GET /api/:collection ───────────────────────────────────────────────────
    if (req.method === 'GET' && !segment2) {
      let queryCursor = col.find({});
      if (batchParam === '1') {
        queryCursor = queryCursor.skip(0).limit(3500);
      } else if (batchParam === '2') {
        queryCursor = queryCursor.skip(3500).limit(3500);
      } else if (batchParam === '3') {
        queryCursor = queryCursor.skip(7000).limit(3500);
      }
      const docs = await queryCursor.toArray();
      const acceptEncoding = String(req.headers['accept-encoding'] || '');
      const jsonStr = JSON.stringify(docs);
      if (acceptEncoding.includes('gzip') && jsonStr.length > 2048) {
        const compressed = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'));
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(200).end(compressed);
      }
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

        // ── مزامنة تعديل الرقم القومي بين المستخدمين والمنصة في الاتجاهين ──
        try {
          const colLower = String(collectionName || '').toLowerCase();
          const normOldNid = String(existingDoc.national_id || existingDoc.passport_no || (colLower === 'users' ? existingDoc.username : '') || '').trim();
          const normNewNid = String(safeUpdate.national_id || safeUpdate.passport_no || (colLower === 'users' ? (safeUpdate.national_id || safeUpdate.username) : '') || '').trim();

          if (normOldNid && normNewNid && normOldNid !== normNewNid) {
            if (colLower === 'users') {
              // تعديل المستخدم في users -> مزامنة الرقم القومي الجديد في كل وثائق المنصة
              const platformCols = [
                'platformstudents',
                'platformapplicants',
                'platformmohfezs',
                'platformcoordinators',
                'platformsupervisors',
                'students',
                'mohfezs',
                'coordinators'
              ];
              for (const pCol of platformCols) {
                await db.collection(pCol).updateMany(
                  { $or: [{ national_id: normOldNid }, { passport_no: normOldNid }] },
                  { $set: { national_id: normNewNid, passport_no: normNewNid } }
                );
              }
            } else {
              // تعديل دارس أو كادر في جداول المنصة -> مزامنة وثيقة المستخدم في users
              const usersCol = db.collection('users');
              const matchedUsers = await usersCol.find({
                $or: [{ national_id: normOldNid }, { username: normOldNid }, { email: normOldNid }]
              }).toArray();

              for (const u of matchedUsers) {
                const uSet = {
                  national_id: normNewNid,
                  username: (String(u.username || '').trim() === normOldNid || !u.username) ? normNewNid : u.username,
                  email: (String(u.email || '').trim() === normOldNid || !u.email) ? normNewNid : u.email,
                };
                if (String(u.password || '').trim() === normOldNid || !u.password) {
                  uSet.password = normNewNid;
                }
                if (String(u.record_number || '').trim() === normOldNid || !u.record_number) {
                  uSet.record_number = normNewNid;
                }
                await usersCol.updateOne({ _id: u._id }, { $set: uSet });
              }
            }
          }
        } catch (syncErr) {
          console.error('Error syncing national_id across collections:', syncErr);
        }

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
