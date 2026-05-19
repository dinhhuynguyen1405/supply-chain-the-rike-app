"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress"; // Giả định UI có Progress
import { 
  TrendingUp, Wallet, ArrowRightLeft, Calculator, 
  Info, UserCheck, Hammer, Ship, Scale, Layers
} from "lucide-react";

interface SplitData {
  summary: {
    totalRevenueVnd: number;
    totalNetProfitVnd: number;
    contributions: {
      huy: number;
      nhung: number;
      total: number;
    },
    ratios: {
      you: number;
      nhung: number;
    },
    huy: {
      capitalRecovery: number;
      serviceIncome: number;
      profitShare: number;
      finalTotal: number;
    },
    nhung: {
      capitalRecovery: number;
      profitShare: number;
      finalTotal: number;
    }
  }
}

export default function RevenueSplitPage() {
  const [data, setData] = useState<SplitData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/revenue-split")
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse font-medium">Đang tính toán tỷ lệ đóng góp thực tế...</div>;
  if (!data) return <div className="p-8 text-center text-red-500 font-medium">Lỗi: Không thể tải dữ liệu tài chính động.</div>;

  const { summary } = data;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-slate-800 uppercase">
            <Scale className="h-6 w-6 text-indigo-600" /> Đối Soát Tỷ Lệ Đóng Góp
          </h1>
          <p className="text-muted-foreground text-sm font-medium italic">Tỷ lệ lợi nhuận tự động thay đổi theo Vốn & Công sức bỏ vào thực tế</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className="bg-indigo-600 px-4 py-1 text-xs shadow-md">MÔ HÌNH CHIA ĐỘNG (DYNAMIC RATIO)</Badge>
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Cập nhật theo thời gian thực</span>
        </div>
      </div>

      {/* TRỰC QUAN HOÁ TỶ LỆ */}
      <Card className="bg-slate-950 text-white p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-10">
           <Scale className="h-32 w-32" />
        </div>
        <div className="flex justify-between items-end mb-4">
           <div>
              <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-[0.2em] mb-1">Tỷ lệ lợi nhuận mỗi bên</p>
              <div className="flex items-center gap-4">
                 <div className="text-4xl font-black">{summary.ratios.you.toFixed(1)}% <span className="text-sm font-light text-slate-400">HUY</span></div>
                 <div className="h-8 w-[1px] bg-slate-700" />
                 <div className="text-4xl font-black">{summary.ratios.nhung.toFixed(1)}% <span className="text-sm font-light text-slate-400">NHUNG</span></div>
              </div>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-bold uppercase text-green-400 tracking-[0.2em] mb-1">Tổng giá trị đóng góp</p>
              <div className="text-3xl font-bold">{formatVND(summary.contributions.total)}</div>
           </div>
        </div>
        <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
           <div style={{ width: `${summary.ratios.you}%` }} className="h-full bg-indigo-500 transition-all duration-1000" />
           <div style={{ width: `${summary.ratios.nhung}%` }} className="h-full bg-pink-500 transition-all duration-1000" />
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
           <span>HUY đóng góp {formatVND(summary.contributions.huy)}</span>
           <span>NHUNG đóng góp {formatVND(summary.contributions.nhung)}</span>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* CARD HUY */}
        <Card className="overflow-hidden border-2 border-indigo-100 shadow-xl">
          <div className="bg-indigo-600 px-5 py-4 text-white flex justify-between items-center">
             <div className="flex items-center gap-2">
               <UserCheck className="h-5 w-5" />
               <span className="font-extrabold tracking-widest">HUY (SỐ LIỆU ĐÓNG GÓP)</span>
             </div>
             <Badge className="bg-white/20 text-white border-none">{summary.ratios.you.toFixed(1)}%</Badge>
          </div>
          <CardContent className="p-0">
            <div className="divide-y text-sm">
              <div className="p-5 flex justify-between items-center">
                <span className="text-slate-500">Vốn Huy bỏ ra:</span>
                <span className="font-bold">{formatVND(summary.huy.capitalRecovery)}</span>
              </div>
              <div className="p-5 bg-indigo-50/30">
                <div className="flex justify-between items-center bg-white p-3 rounded-lg border shadow-sm">
                  <div className="flex items-center gap-2">
                    <Hammer className="h-4 w-4 text-indigo-600" />
                    <span className="font-bold text-indigo-800">Công & Nhãn tính riêng:</span>
                  </div>
                  <span className="font-black text-indigo-800">{formatVND(summary.huy.serviceIncome)}</span>
                </div>
              </div>
              <div className="p-5 flex justify-between items-center">
                <span className="text-slate-500">Lợi nhuận chia sẻ ({summary.ratios.you.toFixed(1)}% Chiếm đoạt):</span>
                <span className="font-bold text-green-600">+{formatVND(summary.huy.profitShare)}</span>
              </div>
              <div className="p-8 bg-indigo-700 flex flex-col items-center">
                <span className="text-[10px] text-indigo-100 font-black uppercase tracking-[0.3em] mb-2">HUY THỰC NHẬN</span>
                <div className="text-4xl font-black text-white">
                  {formatVND(summary.huy.finalTotal)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD NHUNG */}
        <Card className="overflow-hidden border-2 border-pink-100 shadow-xl">
          <div className="bg-pink-600 px-5 py-4 text-white flex justify-between items-center">
             <div className="flex items-center gap-2">
               <UserCheck className="h-5 w-5" />
               <span className="font-extrabold tracking-widest">NHUNG (SỐ LIỆU ĐÓNG GÓP)</span>
             </div>
             <Badge className="bg-white/20 text-white border-none">{summary.ratios.nhung.toFixed(1)}%</Badge>
          </div>
          <CardContent className="p-0">
            <div className="divide-y text-sm">
              <div className="p-5 flex justify-between items-center bg-pink-50/30">
                <div className="flex flex-col">
                  <span className="font-bold text-pink-700">Vốn Nhung bỏ ra:</span>
                  <span className="text-[10px] text-pink-400">Hoàn lại 100% tài chính</span>
                </div>
                <span className="font-black text-pink-700 text-lg">{formatVND(summary.nhung.capitalRecovery)}</span>
              </div>
              <div className="p-5 flex justify-between items-center">
                <div className="flex items-center gap-2 italic text-slate-400">
                  <Ship className="h-4 w-4" />
                  <span>Logistics trách nhiệm (Bóc tách):</span>
                </div>
                <span className="font-bold text-slate-700">{formatVND(summary.contributions.nhung - summary.nhung.capitalRecovery)}</span>
              </div>
              <div className="p-5 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Lợi nhuận chia sẻ ({summary.ratios.nhung.toFixed(1)}% Chiếm đoạt):</span>
                <span className="font-bold text-green-600">+{formatVND(summary.nhung.profitShare)}</span>
              </div>
              <div className="p-8 bg-pink-700 flex flex-col items-center">
                <span className="text-[10px] text-pink-100 font-black uppercase tracking-[0.3em] mb-2">NHUNG THỰC NHẬN</span>
                <div className="text-4xl font-black text-white">
                  {formatVND(summary.nhung.finalTotal)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-xl space-y-4">
         <h4 className="font-black text-sm text-amber-900 uppercase flex items-center gap-2">
            <Layers className="h-5 w-5" /> TẠI SAO TỶ LỆ LẠI THAY ĐỔI? (THE FAIRNESS RATIO)
         </h4>
         <div className="grid md:grid-cols-3 gap-6 text-[11px] leading-relaxed text-amber-900">
            <div className="space-y-1">
               <p className="font-bold">1. TÍNH TỔNG QUYỀN LỢI:</p>
               <p>Hệ thống không chia 70/30 nữa. Nó tính tổng số tiền (Vốn + Công + Ship) mà mỗi bên đã "đổ vào" dự án trong kỳ này.</p>
            </div>
            <div className="space-y-1">
               <p className="font-bold">2. TỰ ĐỘNG CÂN BẰNG:</p>
               <p>Nếu Nhung bỏ thêm vốn mua hàng hoặc phí ship VN-US tăng cao -&gt; Tỷ lệ % của Nhung tự động tăng lên để bảo vệ quyền lợi người bỏ vốn.</p>
            </div>
            <div className="space-y-1">
               <p className="font-bold">3. CÔNG NHẬN CÔNG SỨC:</p>
               <p>Tiền công sản xuất và Nhãn bao bì của Huy được tính là "Đóng góp bằng sức lao động", trực tiếp nâng tỷ lệ % lợi nhuận của Huy.</p>
            </div>
         </div>
      </div>
    </div>
  );
}
