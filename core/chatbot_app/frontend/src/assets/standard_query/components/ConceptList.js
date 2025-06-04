import React from 'react';

function ConceptList({ concepts, onSelectConcept, selectedConcept }) {
  return (
    <div className="concept-list">
      <ul>
        {concepts.map(concept => (
          <li
            key={concept}
            onClick={() => onSelectConcept(concept === selectedConcept ? null : concept)}
            className={selectedConcept === concept ? 'selected' : ''}
          >
            {concept}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ConceptList;