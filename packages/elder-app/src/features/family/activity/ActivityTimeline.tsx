import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@elder-nest/shared';
import { CheckCircle, Clock, AlertTriangle, MessageSquare } from "lucide-react";
import { useConnectedElders } from "@/hooks/useElderData";

export const ActivityTimeline = () => {
    const { elders } = useConnectedElders();
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (elders.length === 0) {
            setActivities([]);
            setLoading(false);
            return;
        }

        const elderId = elders[0].uid;
        const q = query(
            collection(db, "users", elderId, "activity_logs"),
            orderBy("timestamp", "desc"),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const logs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    time: doc.data().timestamp ? new Date(doc.data().timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'
                }));
                setActivities(logs);
            } else {
                // Fallback to static demo if no logs exist yet
                setActivities([
                    { id: 1, type: "medicine", title: "Taken Heart Pill", time: "2:05 PM", status: "success" },
                    { id: 2, type: "mood", title: "Mood Check-in: Happy", time: "10:30 AM", status: "info" },
                    { id: 3, type: "security", title: "Unrecognized person detected", time: "9:15 AM", status: "alert" },
                ]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [elders]);

    if (loading) return <div className="p-4 text-center text-sm text-gray-500">Loading timeline...</div>;

    return (
        <div className="space-y-4">
            {activities.length > 0 ? (
                activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border-l-2 border-transparent hover:border-blue-500">
                        <div className="mt-1">
                            {activity.type === "medicine" && <CheckCircle size={16} className="text-green-500" />}
                            {activity.type === "mood" && <MessageSquare size={16} className="text-blue-500" />}
                            {activity.type === "security" && <AlertTriangle size={16} className="text-red-500" />}
                            {!["medicine", "mood", "security"].includes(activity.type) && <Clock size={16} className="text-gray-400" />}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{activity.title || activity.message}</p>
                            <p className="text-xs text-gray-500">{activity.time}</p>
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center py-6 text-gray-400 text-sm italic">No recent activity detected.</div>
            )}
        </div>
    );
};
