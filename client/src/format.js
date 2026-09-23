// Prices are stored as plain numbers of pesos; this is how they are shown.
export const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
