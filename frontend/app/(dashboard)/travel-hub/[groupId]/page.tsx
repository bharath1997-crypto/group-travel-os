// ... other code preceding the modification

const menuItems: Array<[string, () => void]> = [
    // ... your existing menu items here
];

menuItems.map(([label, fn]) => {
    return (
        // ... the JSX rendering for each menu item
        <MenuItem key={label} label={label} onClick={fn} />
    );
});

// ... other code following the modification