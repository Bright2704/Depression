'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { authClient } from '@/lib/auth-client';
import NavBar from '@/components/NavBar';

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSubscribe = async (plan: 'pro_monthly' | 'pro_yearly') => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      router.push(`/login?redirect=/pricing&plan=${plan}`);
      return;
    }

    setIsLoading(plan);

    try {
      const response = await authClient.fetch('/api/payments/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({
          plan,
          success_url: `${window.location.origin}/dashboard?subscription=success`,
          cancel_url: `${window.location.origin}/pricing?canceled=true`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.checkout_url;
      } else {
        alert('ไม่สามารถเริ่มการชำระเงินได้ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <NavBar />

      <main className="pt-24 pb-20 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-gray-900">เลือกแผนที่เหมาะกับคุณ</h1>
            <p className="mt-4 text-xl text-gray-600">
              เริ่มต้นฟรี หรืออัปเกรดเพื่อปลดล็อกฟีเจอร์เต็มรูปแบบ
            </p>
          </div>

          {/* Current Plan Badge */}
          {isAuthenticated && user?.is_pro && (
            <div className="text-center mb-8">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-700 rounded-full">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                คุณเป็นสมาชิก Pro ({user.subscription_plan === 'pro_yearly' ? 'รายปี' : 'รายเดือน'})
              </span>
            </div>
          )}

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900">ฟรี</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900">฿0</span>
                <span className="text-gray-500">/เดือน</span>
              </div>
              <p className="mt-4 text-gray-600 text-sm">
                เหมาะสำหรับทดลองใช้งาน
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'ตรวจเช็คเบื้องต้น 3 ครั้ง/เดือน',
                  'ผลสรุปทันที',
                  'คำแนะนำพื้นฐาน',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
                {[
                  'ประวัติย้อนหลัง',
                  'กราฟแนวโน้ม',
                  'รายงาน PDF',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-400">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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

            {/* Pro Monthly Plan */}
            <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-8 text-white relative shadow-xl transform md:-translate-y-4">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="px-3 py-1 bg-amber-400 text-amber-900 text-xs font-medium rounded-full">
                  แนะนำ
                </span>
              </div>
              <h3 className="text-xl font-semibold">Pro รายเดือน</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">฿199</span>
                <span className="text-violet-200">/เดือน</span>
              </div>
              <p className="mt-4 text-violet-200 text-sm">
                สำหรับการดูแลสุขภาพจิตอย่างต่อเนื่อง
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'ตรวจเช็คไม่จำกัด',
                  'ประวัติย้อนหลัง 90 วัน',
                  'กราฟแนวโน้มละเอียด',
                  'แจ้งเตือนเช็กอินรายวัน',
                  'รายงาน PDF ดาวน์โหลดได้',
                  'คำแนะนำส่วนบุคคล',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-violet-100">
                    <svg className="w-5 h-5 text-violet-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe('pro_monthly')}
                disabled={isLoading === 'pro_monthly' || (user?.is_pro && user?.subscription_plan === 'pro_monthly')}
                className="mt-8 w-full py-3 bg-white text-violet-700 font-medium rounded-xl hover:bg-violet-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading === 'pro_monthly'
                  ? 'กำลังโหลด...'
                  : user?.is_pro && user?.subscription_plan === 'pro_monthly'
                  ? 'แผนปัจจุบัน'
                  : 'สมัครเลย'}
              </button>
            </div>

            {/* Pro Yearly Plan */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900">Pro รายปี</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900">฿1,599</span>
                <span className="text-gray-500">/ปี</span>
              </div>
              <p className="mt-2 text-green-600 text-sm font-medium">
                ประหยัด ฿789 (33%)
              </p>
              <p className="mt-2 text-gray-600 text-sm">
                คุ้มค่าสำหรับการใช้งานระยะยาว
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'ทุกอย่างใน Pro รายเดือน',
                  'ประวัติย้อนหลัง 1 ปี',
                  'รายงานสรุปรายเดือน',
                  'Priority Support',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe('pro_yearly')}
                disabled={isLoading === 'pro_yearly' || (user?.is_pro && user?.subscription_plan === 'pro_yearly')}
                className="mt-8 w-full py-3 border border-violet-600 text-violet-700 font-medium rounded-xl hover:bg-violet-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading === 'pro_yearly'
                  ? 'กำลังโหลด...'
                  : user?.is_pro && user?.subscription_plan === 'pro_yearly'
                  ? 'แผนปัจจุบัน'
                  : 'สมัครรายปี'}
              </button>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-20">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">คำถามที่พบบ่อย</h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {[
                {
                  q: 'ยกเลิกสมาชิกได้ไหม?',
                  a: 'ได้ครับ คุณสามารถยกเลิกได้ทุกเมื่อ และจะใช้งานได้จนครบรอบบิล',
                },
                {
                  q: 'มีการทดลองใช้ฟรีไหม?',
                  a: 'แผนฟรีสามารถใช้ได้ 3 ครั้ง/เดือน ไม่ต้องผูกบัตร',
                },
                {
                  q: 'ชำระเงินอย่างไร?',
                  a: 'รองรับบัตรเครดิต/เดบิตผ่านระบบ Stripe ที่ปลอดภัย',
                },
                {
                  q: 'ข้อมูลปลอดภัยไหม?',
                  a: 'ข้อมูลทั้งหมดถูกเข้ารหัส และไม่มีการเก็บรูปภาพใบหน้า',
                },
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-xl p-6 border border-gray-100">
                  <h3 className="font-medium text-gray-900">{item.q}</h3>
                  <p className="mt-2 text-sm text-gray-600">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
