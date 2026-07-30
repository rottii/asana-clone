import React from 'react';

const UserAvatar = ({ name, size = 26, style = {}, onClick }) => {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  
  return (
    <div 
      onClick={onClick}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: '#E0E7FF',
        color: '#4F46E5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${size * 0.45}px`,
        fontWeight: '600',
        flexShrink: 0,
        userSelect: 'none',
        ...style
      }}
    >
      {initial}
    </div>
  );
};

export default UserAvatar;
