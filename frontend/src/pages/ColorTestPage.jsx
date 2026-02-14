/**
 * ColorTestPage - Quick visual test for badge color schemes
 */
export default function ColorTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Badge Color Scheme Options
        </h1>

        {/* Current Colors */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Current Colors
          </h2>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-800">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option A: Lighter peach, lighter black */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option A: Lighter peach, lighter black
          </h2>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-600 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option B: Peachy skin tone */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option B: Peachy skin tone
          </h2>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-900">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-gray-600 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option C: Rose/peach/charcoal */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option C: Rose/peach/charcoal
          </h2>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded text-xs bg-rose-100 text-rose-800">
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-800">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-gray-600 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option D: Red/peach/soft black */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option D: Red/peach/soft black
          </h2>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-800">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option E: Darker red variation 1 */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option E: Darker red (bg-red-200 text-red-900)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded text-xs bg-red-200 text-red-900">
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option F: Darker red variation 2 */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option F: Rose darker (bg-rose-100 text-rose-900)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded text-xs bg-rose-100 text-rose-900">
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option G: Darker red variation 3 */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option G: Rose medium (bg-rose-200 text-rose-900)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded text-xs bg-rose-200 text-rose-900">
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option H: Crimson variation */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option H: Red medium (bg-red-100 text-red-900)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-900">
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option I: Custom red from image (hair color) */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option I: Custom red (hair color from image)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(5deg 66% 85%)",
                color: "hsl(5deg 66% 36%)",
              }}
            >
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option J: Custom red lighter background */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option J: Custom red (lighter bg)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(5deg 66% 90%)",
                color: "hsl(5deg 66% 36%)",
              }}
            >
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option K: Custom red darker text */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option K: Custom red (darker text)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(5deg 66% 85%)",
                color: "hsl(5deg 66% 30%)",
              }}
            >
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option L: Hair color as background, white text */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option L: Hair color bg + white text
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(5deg 66% 36%)", color: "#ffffff" }}
            >
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option M: Hair color as background, light pink text */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option M: Hair color bg + light pink text
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(5deg 66% 36%)",
                color: "hsl(5deg 66% 90%)",
              }}
            >
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option N: Hair color as background, cream text */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option N: Hair color bg + cream text
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(5deg 66% 36%)", color: "#fef3c7" }}
            >
              Character Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-900">
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option O: Peach skin bg + dark brown text */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option O: Peach skin bg + dark brown text
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(5deg 66% 36%)", color: "#ffffff" }}
            >
              Character Name
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 68%)",
                color: "hsl(19deg 33% 25%)",
              }}
            >
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option P: Peach skin bg + darker text */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option P: Peach skin bg + darker text
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(5deg 66% 36%)", color: "#ffffff" }}
            >
              Character Name
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 68%)",
                color: "hsl(19deg 33% 20%)",
              }}
            >
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Option Q: Peach skin bg + black text */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Option Q: Peach skin bg + black text
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(5deg 66% 36%)", color: "#ffffff" }}
            >
              Character Name
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 68%)",
                color: "#1f2937",
              }}
            >
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        <hr className="my-8 border-t-2 border-gray-300" />
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Red Hue Variations (with P-3 peach + P-4 black)
        </h2>

        {/* Red-1: Pure red (0 deg) */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Red-1: Pure red (0 deg hue)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(0deg 66% 36%)", color: "#ffffff" }}
            >
              Character Name
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 90%)",
                color: "hsl(19deg 33% 20%)",
              }}
            >
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Red-2: Slightly magenta red (355 deg) */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Red-2: Magenta-red (355 deg hue)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(355deg 66% 36%)",
                color: "#ffffff",
              }}
            >
              Character Name
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 90%)",
                color: "hsl(19deg 33% 20%)",
              }}
            >
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Red-3: Current (5 deg) */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Red-3: Current (5 deg hue) - for comparison
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(5deg 66% 36%)", color: "#ffffff" }}
            >
              Character Name
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 90%)",
                color: "hsl(19deg 33% 20%)",
              }}
            >
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Red-4: More saturated */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Red-4: More saturated (0 deg, 75% saturation)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(0deg 75% 36%)", color: "#ffffff" }}
            >
              Character Name
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 90%)",
                color: "hsl(19deg 33% 20%)",
              }}
            >
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Example Red-1 */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Example: Red-1 (Pure Red)
          </h2>
          <div className="flex flex-wrap gap-1">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(0deg 66% 36%)", color: "#ffffff" }}
            >
              Ahri
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(0deg 66% 36%)", color: "#ffffff" }}
            >
              Katarina
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 90%)",
                color: "hsl(19deg 33% 20%)",
              }}
            >
              League of Legends
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-white">
              kda
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-white">
              spirit blossom
            </span>
          </div>
        </section>

        <hr className="my-8 border-t-2 border-gray-300" />
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Variations on Option P
        </h2>

        {/* P-1: Lighter peach */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            P-1: Lighter peach (75% lightness)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(5deg 66% 36%)", color: "#ffffff" }}
            >
              Character Name
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 75%)",
                color: "hsl(19deg 33% 20%)",
              }}
            >
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-500 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* P-2: Lighter peach, darker black */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            P-2: Lighter peach + darker black (slate-600)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(5deg 66% 36%)", color: "#ffffff" }}
            >
              Character Name
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 75%)",
                color: "hsl(19deg 33% 20%)",
              }}
            >
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-600 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* P-3: Even lighter peach */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            P-3: Even lighter peach (80% lightness)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(5deg 66% 36%)", color: "#ffffff" }}
            >
              Character Name
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 80%)",
                color: "hsl(19deg 33% 20%)",
              }}
            >
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-600 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* P-4: Lighter peach, darkest black */}
        <section className="mb-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            P-4: Lighter peach + darkest black (slate-700)
          </h2>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(5deg 66% 36%)", color: "#ffffff" }}
            >
              Character Name
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 75%)",
                color: "hsl(19deg 33% 20%)",
              }}
            >
              Series Name
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-white">
              tag name
            </span>
          </div>
        </section>

        {/* Example with multiple badges - P-2 */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Example with Multiple Badges (P-2 - Recommended)
          </h2>
          <div className="flex flex-wrap gap-1">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(5deg 66% 36%)", color: "#ffffff" }}
            >
              Ahri
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: "hsl(5deg 66% 36%)", color: "#ffffff" }}
            >
              Katarina
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "hsl(19deg 33% 75%)",
                color: "hsl(19deg 33% 20%)",
              }}
            >
              League of Legends
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-600 text-white">
              kda
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-600 text-white">
              spirit blossom
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-600 text-white">
              default skin
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
