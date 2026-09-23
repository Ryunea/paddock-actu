// Liste des articles du site, une entrée par page dans articles/.
// Pour publier un article : créer articles/<slug>.html puis ajouter une entrée ici.
// Les cartes de l'accueil, du catalogue et des "À lire aussi" sont générées à partir de cette liste.
// Catégories possibles : motogp, moto2, moto3, paddock.
// gp : code court du Grand Prix concerné (shortname dans data/calendar.json : AUT, JPN, FRA...),
// l'article apparaît alors sur la fiche du GP dans le calendrier. À omettre pour un article hors GP.
const ARTICLES = [
   {
    slug: '850cc',
    title: 'Tests privés 850cc',
    excerpt: 'Résumé du dernier test privé 850cc sur le circuit de Spielberg.',
    category: 'motogp',       
    gp: 'AUT',                 
    date: '2026-09-23',       
    author: 'Lucas',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDRbUdUn6-3lhkaW9TfPlt2Sxub348jOZPwukN6IxL_w&s=10'
},
    
    {
        slug: 'gp-autriche-2026',
        title: "Grand Prix d'Autriche : une première au Red Bull Ring",
        excerpt: "Résumé complet de la victoire de Pedro Acosta, du podium d'Aprilia et des rebondissements de la course.",
        category: 'motogp',
        gp: 'AUT',
        date: '2026-09-21',
        author: 'Lucas',
        image: 'https://365austria.com/wp-content/uploads/2024/09/c_PhilipPlatzer_Bulle.jpg'
    },
    {
        slug: 'sprint-autriche-2026',
        title: 'Sprint mouvementé en Autriche',
        excerpt: "Résumé complet des essais, des qualifications et d'une course sprint folle au Red Bull Ring.",
        category: 'motogp',
        gp: 'AUT',
        date: '2026-09-20',
        author: 'Lucas',
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSOQkGnvHQmfFVPExAdJ0Qw_AG-qZpfalbh5KAT9hFJjg&s=10'
    },
    {
        slug: 'preview-autriche-2026',
        title: "Preview Grand Prix d'Autriche",
        excerpt: "Tout ce qu'il faut savoir avant le début du week-end en Autriche : transferts, retours et forfaits.",
        category: 'paddock',
        gp: 'AUT',
        date: '2026-09-17',
        author: 'Lucas',
        image: 'https://resources.motogp.pulselive.com/photo-resources/2026/04/24/52c4a71c-d42e-402c-90f0-fde68ff454e2/Agius.jpg?width=800&height=450'
    }
];
