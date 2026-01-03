export type Testimonial = {
  id: string;
  name: string;
  role: string;
  avatar: string;
  weekly: string;
  date: string;
  text: string;
};

export const testimonials: Testimonial[] = [
  {
    id: "maya",
    name: "Maya Srinivasan",
    role: "Driver Partner",
    avatar: "https://i.pravatar.cc/150?img=47",
    weekly: "₹32,000",
    date: "Nov 2023",
    text: "Transparent settlements and reliable cars let me focus on earning without surprises.",
  },
  {
    id: "rahul",
    name: "Rahul Nair",
    role: "Fleet Supervisor",
    avatar: "https://i.pravatar.cc/150?img=12",
    weekly: "₹28,500",
    date: "Dec 2023",
    text: "The support team is always available and payouts arrive exactly when promised.",
  },
  {
    id: "sophia",
    name: "Sophia Dsouza",
    role: "Driver Partner",
    avatar: "https://i.pravatar.cc/150?img=5",
    weekly: "₹30,200",
    date: "Jan 2024",
    text: "Comfortable accommodation and fair rentals keep me productive across long shifts.",
  },
];
