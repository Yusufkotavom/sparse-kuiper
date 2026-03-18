"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function DeprecatedLooperStudioPage() {
    const params = useParams();
    const router = useRouter();
    const projectName = typeof params?.project === "string" ? params.project : "";
    const isRedirecting = Boolean(projectName);

    useEffect(() => {
        if (!projectName) return;
        const timer = setTimeout(() => {
            router.replace(`/looper?project=${encodeURIComponent(projectName)}`);
        }, 900);
        return () => clearTimeout(timer);
    }, [projectName, router]);

    return (
        <div className="p-6 max-w-[900px] mx-auto space-y-4">
            <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader>
                    <CardTitle className="text-amber-300">Looper Studio Lama (Deprecated)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Halaman ini dipindahkan ke Looper terpadu. Kamu akan diarahkan otomatis.
                    </p>
                    <Button
                        onClick={() => router.replace(`/looper?project=${encodeURIComponent(projectName)}`)}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                        disabled={!projectName}
                    >
                        {isRedirecting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Mengalihkan…
                            </>
                        ) : (
                            "Buka /looper sekarang"
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
