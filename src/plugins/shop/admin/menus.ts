export default [
  { label: '쇼핑몰', icon: 'ShoppingBag', isGroup: true, children: [
    { label: '대시보드', icon: 'BarChart3', path: '/admin/shop' },
    { label: '상품관리', icon: 'Package', path: '/admin/shop/products' },
    { label: '카테고리', icon: 'ShoppingBag', path: '/admin/shop/categories' },
    { label: '주문관리', icon: 'ClipboardList', path: '/admin/shop/orders' },
    { label: '매출관리', icon: 'TrendingUp', path: '/admin/shop/sales' },
    { label: '리뷰관리', icon: 'Star', path: '/admin/shop/reviews' },
    { label: 'Q&A관리', icon: 'MessageSquare', path: '/admin/shop/qna' },
    { label: '배송비정책', icon: 'Truck', path: '/admin/shop/delivery' },
    { label: '쇼핑몰설정', icon: 'Settings', path: '/admin/shop/settings' },
  ]},
]
