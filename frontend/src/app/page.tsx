/**
 * Landing Page - FacePsy Wellness Platform
 * Professional, trustworthy design for emotional wellness screening
 */

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg"></div>
            <span className="text-xl font-semibold text-gray-800">MindCheck</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="#how-it-works" className="text-gray-600 hover:text-gray-800 text-sm">วิธีการทำงาน</Link>
            <Link href="#privacy" className="text-gray-600 hover:text-gray-800 text-sm">ความเป็นส่วนตัว</Link>
            <Link href="#pricing" className="text-gray-600 hover:text-gray-800 text-sm">ราคา</Link>
            <Link
              href="/scan"
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all"
            >
              เริ่มตรวจฟรี
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-700 rounded-full text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></span>
            อ้างอิงจากงานวิจัยระดับนานาชาติ
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
            ตรวจเช็คภาวะอารมณ์เบื้องต้น
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
              ใน 60 วินาที
            </span>
          </h1>

          <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
            ใช้การวิเคราะห์การแสดงออกทางใบหน้าร่วมกับแบบประเมินสั้น
            เพื่อช่วยให้คุณเข้าใจตัวเองมากขึ้น และรู้ว่าควรทำอะไรต่อ
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/scan"
              className="px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-lg font-medium rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-200"
            >
              เริ่มตรวจฟรี
            </Link>
            <Link
              href="#how-it-works"
              className="px-8 py-4 border border-gray-300 text-gray-700 text-lg font-medium rounded-xl hover:bg-gray-50 transition-all"
            >
              ดูวิธีการทำงาน
            </Link>
          </div>

          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>ไม่เก็บรูปภาพ</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>ข้อมูลเข้ารหัส</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>ลบข้อมูลได้</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">วิธีการทำงาน</h2>
            <p className="mt-4 text-gray-600">กระบวนการง่าย ๆ 4 ขั้นตอน ใช้เวลาไม่ถึงนาที</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: '1',
                title: 'ยืนยันความยินยอม',
                description: 'อ่านและยืนยันว่าคุณเข้าใจวิธีการใช้งานข้อมูลของเรา',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                step: '2',
                title: 'ตอบคำถามสั้น ๆ',
                description: 'แบบสอบถาม 3-5 ข้อ เกี่ยวกับอารมณ์และการนอนหลับ',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                ),
              },
              {
                step: '3',
                title: 'สแกนใบหน้า 30 วินาที',
                description: 'ระบบวิเคราะห์การแสดงออกโดยไม่บันทึกภาพ',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ),
              },
              {
                step: '4',
                title: 'รับผลและคำแนะนำ',
                description: 'ดูผลสรุปพร้อมคำแนะนำที่เหมาะสมกับคุณ',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
              },
            ].map((item, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-xl flex items-center justify-center text-white mb-4">
                  {item.icon}
                </div>
                <div className="text-sm text-violet-600 font-medium mb-2">ขั้นตอน {item.step}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section id="privacy" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                ความเป็นส่วนตัวคือสิ่งสำคัญที่สุด
              </h2>
              <p className="text-gray-600 mb-8">
                เราออกแบบระบบโดยยึดหลัก Privacy-by-Design
                ข้อมูลใบหน้าของคุณจะถูกประมวลผลในเครื่องของคุณเท่านั้น
                และถูกลบทิ้งภายใน 20 วินาที
              </p>

              <div className="space-y-4">
                {[
                  {
                    title: 'ไม่เก็บรูปภาพ',
                    description: 'รูปภาพถูกประมวลผลและลบทิ้งทันที ส่งเฉพาะค่าสถิติไปยังเซิร์ฟเวอร์',
                  },
                  {
                    title: 'เข้ารหัสแบบ End-to-End',
                    description: 'ข้อมูลทั้งหมดถูกเข้ารหัสก่อนส่ง ไม่มีใครอ่านได้นอกจากคุณ',
                  },
                  {
                    title: 'ลบข้อมูลได้ทุกเมื่อ',
                    description: 'คุณสามารถลบข้อมูลทั้งหมดของคุณได้ทันทีเมื่อต้องการ',
                  },
                  {
                    title: 'ไม่ขายข้อมูล',
                    description: 'เราไม่ขายหรือแชร์ข้อมูลของคุณให้กับบุคคลที่สาม',
                  },
                ].map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-violet-100 to-indigo-100 rounded-3xl p-8">
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-900">ข้อมูลที่เราเก็บ</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                    ค่าสถิติการแสดงออกทางใบหน้า (AUs)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                    มุมการเอียงศีรษะ (Head Pose)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                    อัตราการกระพริบตา (EAR)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                    คำตอบจากแบบสอบถาม
                  </li>
                </ul>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>ไม่เก็บ: รูปภาพ, วิดีโอ, เสียง</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">แผนราคา</h2>
            <p className="mt-4 text-gray-600">เริ่มต้นใช้งานฟรี อัปเกรดเมื่อพร้อม</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">ฟรี</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900">฿0</span>
                <span className="text-gray-500">/เดือน</span>
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  'ตรวจเช็คเบื้องต้น 3 ครั้ง/เดือน',
                  'ผลสรุปทันที',
                  'คำแนะนำพื้นฐาน',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/scan"
                className="mt-8 block w-full py-3 text-center border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
              >
                เริ่มต้นฟรี
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-8 text-white relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="px-3 py-1 bg-amber-400 text-amber-900 text-xs font-medium rounded-full">
                  แนะนำ
                </span>
              </div>
              <h3 className="text-xl font-semibold">Pro</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">฿199</span>
                <span className="text-violet-200">/เดือน</span>
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  'ตรวจเช็คไม่จำกัด',
                  'ประวัติย้อนหลัง 30 วัน',
                  'กราฟแนวโน้ม',
                  'แจ้งเตือนเช็กอิน',
                  'รายงาน PDF',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-violet-100">
                    <svg className="w-5 h-5 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <button className="mt-8 w-full py-3 bg-white text-violet-700 font-medium rounded-xl hover:bg-violet-50 transition-all">
                เริ่มทดลองใช้ 7 วัน
              </button>
            </div>

            {/* Business Plan */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Business</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900">ติดต่อ</span>
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  'Dashboard สำหรับ HR',
                  'รายงานภาพรวมทีม (Anonymous)',
                  'API Integration',
                  'Support ลำดับแรก',
                  'Custom Branding',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <button className="mt-8 w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all">
                ติดต่อฝ่ายขาย
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            พร้อมเริ่มดูแลสุขภาพจิตของคุณแล้วหรือยัง?
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            เริ่มตรวจเช็คฟรีวันนี้ ไม่ต้องสมัครสมาชิก
          </p>
          <Link
            href="/scan"
            className="inline-flex px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-lg font-medium rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-200"
          >
            เริ่มตรวจฟรี
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg"></div>
              <span className="text-xl font-semibold text-gray-800">MindCheck</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-600">
              <Link href="/privacy" className="hover:text-gray-800">นโยบายความเป็นส่วนตัว</Link>
              <Link href="/terms" className="hover:text-gray-800">เงื่อนไขการใช้งาน</Link>
              <Link href="/contact" className="hover:text-gray-800">ติดต่อเรา</Link>
            </div>

            <div className="text-sm text-gray-500">
              © 2024 MindCheck. All rights reserved.
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-100 text-center text-sm text-gray-500">
            <p>
              ผลลัพธ์จากระบบนี้เป็นเพียงการประเมินเบื้องต้นเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์
              หากคุณมีข้อกังวลด้านสุขภาพจิต กรุณาปรึกษาผู้เชี่ยวชาญ
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
