import React from 'react';

/**
 * LayoutTestPage - Visual comparison of different PostCard layout options
 * 
 * This page displays 4 different layout variations side-by-side using the same mock data
 * to help determine which layout is most space-efficient and readable.
 */

// Mock post data for testing using real test thumbnails
const mockPost = {
  id: 1,
  title: "Ahri (League of Legends)",
  characters: ["Ahri"],
  series: ["League of Legends"],
  tags: ["kda", "spirit blossom", "default skin", "star guardian", "arcade"],
  thumbnail_urls: [
    "/test_thumbnails/Ahri_01.jpg",
    "/test_thumbnails/Ahri_02.jpg",
    "/test_thumbnails/Ahri_03.jpg",
    "/test_thumbnails/Ahri_04.jpg",
    "/test_thumbnails/Ahri_05.jpg",
    "/test_thumbnails/Ahri_06.jpg"
  ],
  timestamp: "2026-01-28T10:30:00Z",
  patreon_url: "#"
};

// Option A: Compact Horizontal Layout (150px thumbnail, tighter spacing)
function CompactHorizontalCard({ post }) {
  const additionalImageCount = post.thumbnail_urls?.length > 1 ? post.thumbnail_urls.length - 1 : 0;

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow overflow-hidden flex">
      {/* Thumbnail - 150px width */}
      <div className="relative w-[150px] h-[150px] flex-shrink-0 cursor-pointer group">
        {post.thumbnail_urls?.[0] ? (
          <>
            <img
              src={post.thumbnail_urls[0]}
              alt={post.title}
              className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
            />
            {additionalImageCount > 0 && (
              <div className="absolute top-1 right-1 bg-black bg-opacity-75 text-white px-1.5 py-0.5 rounded text-xs font-semibold">
                +{additionalImageCount}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-xs">No preview</span>
          </div>
        )}
      </div>

      {/* Content section - tighter spacing */}
      <div className="p-2 flex-1 flex flex-col min-w-0">
        {/* Title and Date */}
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 flex-1">
            {post.title}
          </h3>
          {post.timestamp && (
            <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
              {new Date(post.timestamp).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="space-y-0.5 flex-1 text-xs">
          {post.characters?.length > 0 && (
            <div className="truncate">
              <span className="font-medium text-gray-600">Characters: </span>
              <span className="text-gray-900">{post.characters.join(", ")}</span>
            </div>
          )}

          {post.series?.length > 0 && (
            <div className="truncate">
              <span className="font-medium text-gray-600">Series: </span>
              <span className="text-gray-900">{post.series.join(", ")}</span>
            </div>
          )}

          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {post.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                  {tag}
                </span>
              ))}
              {post.tags.length > 3 && (
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                  +{post.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-1 pt-1 border-t border-gray-100 flex gap-2 justify-between items-center">
          <a
            href={post.patreon_url}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            View on Patreon →
          </a>
          <button className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs font-medium">
            Suggest Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// Option B: Vertical Card (Pinterest-style - thumbnail on top, content below)
function VerticalCard({ post }) {
  const additionalImageCount = post.thumbnail_urls?.length > 1 ? post.thumbnail_urls.length - 1 : 0;

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow overflow-hidden flex flex-col max-w-[240px]">
      {/* Thumbnail on top - max 240px width */}
      <div className="relative w-full cursor-pointer group">
        {post.thumbnail_urls?.[0] ? (
          <>
            <img
              src={post.thumbnail_urls[0]}
              alt={post.title}
              className="w-full h-auto object-contain group-hover:opacity-90 transition-opacity"
            />
            {additionalImageCount > 0 && (
              <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm font-semibold">
                +{additionalImageCount}
              </div>
            )}
          </>
        ) : (
          <div className="w-full aspect-square bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-sm">No preview</span>
          </div>
        )}
      </div>

      {/* Content below */}
      <div className="p-3 flex-1 flex flex-col">
        {/* Title and Date */}
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-base text-gray-900 line-clamp-2 flex-1">
            {post.title}
          </h3>
          {post.timestamp && (
            <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
              {new Date(post.timestamp).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="space-y-1 flex-1 text-sm">
          {post.characters?.length > 0 && (
            <div>
              <span className="font-medium text-gray-600">Characters: </span>
              <span className="text-gray-900">{post.characters.join(", ")}</span>
            </div>
          )}

          {post.series?.length > 0 && (
            <div>
              <span className="font-medium text-gray-600">Series: </span>
              <span className="text-gray-900">{post.series.join(", ")}</span>
            </div>
          )}

          {post.tags?.length > 0 && (
            <div>
              <span className="font-medium text-gray-600">Tags: </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {post.tags.slice(0, 5).map((tag, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                    {tag}
                  </span>
                ))}
                {post.tags.length > 5 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                    +{post.tags.length - 5}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2 justify-between items-center">
          <a
            href={post.patreon_url}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View on Patreon →
          </a>
          <button className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs font-medium">
            Suggest Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// Option C: Grid Card (Square thumbnail with minimal text)
function GridCard({ post }) {
  const additionalImageCount = post.thumbnail_urls?.length > 1 ? post.thumbnail_urls.length - 1 : 0;

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow overflow-hidden max-w-[240px]">
      {/* Thumbnail - natural size, max 240px */}
      <div className="relative cursor-pointer group">
        {post.thumbnail_urls?.[0] ? (
          <>
            <img
              src={post.thumbnail_urls[0]}
              alt={post.title}
              className="w-full h-auto object-contain group-hover:opacity-90 transition-opacity"
            />
            {additionalImageCount > 0 && (
              <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm font-semibold">
                +{additionalImageCount}
              </div>
            )}
            {/* Text overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <h3 className="font-semibold text-sm text-white line-clamp-2">
                {post.title}
              </h3>
            </div>
          </>
        ) : (
          <div className="w-full aspect-square bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-sm">No preview</span>
          </div>
        )}
      </div>

      {/* Minimal content below */}
      <div className="p-2">
        {/* Date */}
        {post.timestamp && (
          <div className="text-xs text-gray-500 mb-1">
            {new Date(post.timestamp).toLocaleDateString()}
          </div>
        )}
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {post.tags?.slice(0, 3).map((tag, idx) => (
            <span key={idx} className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
              {tag}
            </span>
          ))}
          {post.tags?.length > 3 && (
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
              +{post.tags.length - 3}
            </span>
          )}
        </div>
        {/* Actions */}
        <div className="flex gap-1 justify-between items-center pt-1 border-t border-gray-100">
          <a href={post.patreon_url} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
            Patreon →
          </a>
          <button className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs font-medium">
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// Option D: Two-column Grid View (showing how 2 cards look side-by-side)
function TwoColumnGridDemo({ post }) {
  const additionalImageCount = post.thumbnail_urls?.length > 1 ? post.thumbnail_urls.length - 1 : 0;

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div className="relative aspect-square cursor-pointer group">
        {post.thumbnail_urls?.[0] ? (
          <>
            <img
              src={post.thumbnail_urls[0]}
              alt={post.title}
              className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
            />
            {additionalImageCount > 0 && (
              <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm font-semibold">
                +{additionalImageCount}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-sm">No preview</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col">
        {/* Title and Date */}
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-base text-gray-900 line-clamp-2 flex-1">
            {post.title}
          </h3>
          {post.timestamp && (
            <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
              {new Date(post.timestamp).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="space-y-1 flex-1 text-sm">
          {post.characters?.length > 0 && (
            <div>
              <span className="font-medium text-gray-600">Characters: </span>
              <span className="text-gray-900">{post.characters.join(", ")}</span>
            </div>
          )}

          {post.series?.length > 0 && (
            <div>
              <span className="font-medium text-gray-600">Series: </span>
              <span className="text-gray-900">{post.series.join(", ")}</span>
            </div>
          )}

          {post.tags?.length > 0 && (
            <div>
              <span className="font-medium text-gray-600">Tags: </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {post.tags.slice(0, 5).map((tag, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                    {tag}
                  </span>
                ))}
                {post.tags.length > 5 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                    +{post.tags.length - 5}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2 justify-between items-center">
          <a
            href={post.patreon_url}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View on Patreon →
          </a>
          <button className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs font-medium">
            Suggest Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Layout Test Page
export default function LayoutTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            PostCard Layout Comparison
          </h1>
          <p className="text-gray-600">
            Compare different layout options side-by-side using the same mock data.
            Evaluate space efficiency and readability.
          </p>
        </div>

        {/* Layout Variations */}
        <div className="space-y-12">
          {/* Option A: Compact Horizontal */}
          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Option A: Compact Horizontal
              </h2>
              <p className="text-gray-600">
                150px thumbnail, tighter spacing, horizontal layout. Best for list views with limited vertical space.
              </p>
            </div>
            <div className="max-w-2xl">
              <CompactHorizontalCard post={mockPost} />
            </div>
          </section>

          {/* Option B: Vertical Card */}
          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Option B: Vertical Card (Pinterest-style)
              </h2>
              <p className="text-gray-600">
                Thumbnail on top (3:4 aspect ratio), content below. Emphasizes visual content, good for browsing.
              </p>
            </div>
            <div className="max-w-sm">
              <VerticalCard post={mockPost} />
            </div>
          </section>

          {/* Option C: Grid Card */}
          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Option C: Grid Card
              </h2>
              <p className="text-gray-600">
                Square thumbnail with text overlay and minimal content below. Most compact, image-focused design.
              </p>
            </div>
            <div className="max-w-xs">
              <GridCard post={mockPost} />
            </div>
          </section>

          {/* Option D: Two-column Grid */}
          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Option D: Two-column Grid View
              </h2>
              <p className="text-gray-600">
                Shows how cards look side-by-side in a 2-column layout. Current design style.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-3xl">
              <TwoColumnGridDemo post={mockPost} />
              <TwoColumnGridDemo post={mockPost} />
            </div>
          </section>
        </div>

        {/* Comparison Summary */}
        <div className="mt-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Layout Comparison Summary
          </h2>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-4 gap-4 font-semibold text-gray-700 pb-2 border-b">
              <div>Layout</div>
              <div>Space Efficiency</div>
              <div>Readability</div>
              <div>Best Use Case</div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="font-medium">Option A</div>
              <div className="text-green-600">★★★★☆</div>
              <div className="text-yellow-600">★★★☆☆</div>
              <div className="text-gray-600">Dense lists, mobile</div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="font-medium">Option B</div>
              <div className="text-yellow-600">★★★☆☆</div>
              <div className="text-green-600">★★★★★</div>
              <div className="text-gray-600">Visual browsing, discovery</div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="font-medium">Option C</div>
              <div className="text-green-600">★★★★★</div>
              <div className="text-yellow-600">★★☆☆☆</div>
              <div className="text-gray-600">Image galleries, quick scan</div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="font-medium">Option D</div>
              <div className="text-green-600">★★★★☆</div>
              <div className="text-green-600">★★★★☆</div>
              <div className="text-gray-600">Balanced grid view (current)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
