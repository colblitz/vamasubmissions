import { useState, useEffect, useRef } from "react";

/**
 * Reusable autocomplete input component
 * 
 * @param {string} value - Current input value
 * @param {function} onChange - Callback when input changes
 * @param {function} onSelect - Callback when suggestion is selected
 * @param {array} suggestions - Array of suggestion strings
 * @param {string} placeholder - Input placeholder text
 * @param {string} className - Additional CSS classes for input
 * @param {function} onKeyPress - Optional callback for key press events
 * @param {boolean} showNoResults - Whether to show "No results" message
 */
export default function AutocompleteInput({
  value,
  onChange,
  onSelect,
  suggestions = [],
  placeholder = "Type to search...",
  className = "",
  onKeyPress,
  showNoResults = true,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Show dropdown when there are suggestions or when showing "no results"
  const shouldShowDropdown = value.length >= 3 && (suggestions.length > 0 || showNoResults);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update isOpen when shouldShowDropdown changes
  useEffect(() => {
    setIsOpen(shouldShowDropdown);
  }, [shouldShowDropdown]);

  const handleInputChange = (e) => {
    onChange(e.target.value);
    setIsOpen(true);
  };

  const handleSelect = (suggestion) => {
    onSelect(suggestion);
    setIsOpen(false);
  };

  const handleKeyPress = (e) => {
    if (onKeyPress) {
      onKeyPress(e);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 ${className}`}
      />
      
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(suggestion)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900"
              >
                {suggestion}
              </button>
            ))
          ) : showNoResults ? (
            <div className="px-4 py-2 text-gray-500 text-sm">No results found</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
