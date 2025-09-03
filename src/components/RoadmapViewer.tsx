import { useEffect, useState } from "react";

interface Stage {
  stage_title: string;
  goal: string;
  key_points: string[];
}

interface RoadmapResponse {
  career: string;
  starting_class: number;
  roadmap: Stage[];
}

export default function RoadmapViewer({
  selectedCareer,
  selectedClass,
}: {
  selectedCareer: string;
  selectedClass: number;
}) {
  const [roadmapData, setRoadmapData] = useState<RoadmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCareer || !selectedClass) return;

    setLoading(true);
    fetch(
      `http://localhost:5000/api/roadmap?career=${selectedCareer}&class=${selectedClass}`
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch roadmap");
        return res.json();
      })
      .then((data: RoadmapResponse) => {
        setRoadmapData(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setRoadmapData(null);
      })
      .finally(() => setLoading(false));
  }, [selectedCareer, selectedClass]);

  if (loading) return <p className="text-blue-600">Loading roadmap...</p>;
  if (error) return <p className="text-red-600">⚠ {error}</p>;
  if (!roadmapData) return <p>No roadmap available.</p>;

  return (
    <div className="mt-4 space-y-4">
      <h2 className="text-2xl font-bold text-green-700">
        {roadmapData.career} Roadmap (from Class {roadmapData.starting_class})
      </h2>
      {roadmapData.roadmap.map((stage, idx) => (
        <div
          key={idx}
          className="p-4 bg-white rounded-xl shadow-md border border-gray-200"
        >
          <h3 className="text-lg font-semibold mb-1">{stage.stage_title}</h3>
          <p className="text-sm text-gray-700 mb-2">{stage.goal}</p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            {stage.key_points.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
