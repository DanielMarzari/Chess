// Small ECO openings database — covers common openings by move-prefix matching
// against a normalized list of SAN moves.

interface Opening {
  eco: string;
  name: string;
  moves: string[]; // SAN move sequence (prefix)
}

// Use the deepest (longest) match when multiple prefixes apply
export const OPENINGS: Opening[] = [
  { eco: 'A00', name: "Irregular (A00)", moves: [] },
  { eco: 'A00', name: "Van 't Kruijs Opening", moves: ['e3'] },
  { eco: 'A00', name: 'Mieses Opening', moves: ['d3'] },
  { eco: 'A00', name: 'Ware Opening', moves: ['a4'] },
  { eco: 'A00', name: 'Anderssen Opening', moves: ['a3'] },
  { eco: 'A00', name: 'Sodium Attack', moves: ['Na3'] },
  { eco: 'A00', name: 'Grob Opening', moves: ['g4'] },
  { eco: 'A00', name: 'Saragossa Opening', moves: ['c3'] },
  { eco: 'A01', name: 'Nimzowitsch-Larsen Attack', moves: ['b3'] },
  { eco: 'A02', name: 'Bird Opening', moves: ['f4'] },
  { eco: 'A02', name: "Bird's Opening: From's Gambit", moves: ['f4', 'e5'] },
  { eco: 'A04', name: 'Réti Opening', moves: ['Nf3'] },
  { eco: 'A07', name: 'King\'s Indian Attack', moves: ['Nf3', 'd5', 'g3'] },
  { eco: 'A10', name: 'English Opening', moves: ['c4'] },
  { eco: 'A15', name: 'English: Anglo-Indian Defense', moves: ['c4', 'Nf6'] },
  { eco: 'A20', name: 'English: King\'s English', moves: ['c4', 'e5'] },
  { eco: 'A40', name: 'Queen\'s Pawn', moves: ['d4'] },
  { eco: 'A43', name: 'Old Benoni', moves: ['d4', 'c5'] },
  { eco: 'A45', name: 'Indian Defense', moves: ['d4', 'Nf6'] },
  { eco: 'A46', name: 'Indian: Knights Variation', moves: ['d4', 'Nf6', 'Nf3'] },
  { eco: 'A50', name: 'Indian: Normal Variation', moves: ['d4', 'Nf6', 'c4'] },
  { eco: 'A56', name: 'Benoni Defense', moves: ['d4', 'Nf6', 'c4', 'c5'] },
  { eco: 'A57', name: 'Benko Gambit', moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5'] },
  { eco: 'A80', name: 'Dutch Defense', moves: ['d4', 'f5'] },
  { eco: 'B00', name: 'King\'s Pawn', moves: ['e4'] },
  { eco: 'B00', name: 'Nimzowitsch Defense', moves: ['e4', 'Nc6'] },
  { eco: 'B01', name: 'Scandinavian Defense', moves: ['e4', 'd5'] },
  { eco: 'B02', name: 'Alekhine Defense', moves: ['e4', 'Nf6'] },
  { eco: 'B06', name: 'Modern Defense', moves: ['e4', 'g6'] },
  { eco: 'B07', name: 'Pirc Defense', moves: ['e4', 'd6'] },
  { eco: 'B10', name: 'Caro-Kann Defense', moves: ['e4', 'c6'] },
  { eco: 'B12', name: 'Caro-Kann: Advance', moves: ['e4', 'c6', 'd4', 'd5', 'e5'] },
  { eco: 'B20', name: 'Sicilian Defense', moves: ['e4', 'c5'] },
  { eco: 'B21', name: 'Sicilian: Smith-Morra Gambit', moves: ['e4', 'c5', 'd4'] },
  { eco: 'B23', name: 'Sicilian: Closed', moves: ['e4', 'c5', 'Nc3'] },
  { eco: 'B27', name: 'Sicilian: Hyperaccelerated Dragon', moves: ['e4', 'c5', 'Nf3', 'g6'] },
  { eco: 'B30', name: 'Sicilian: Rossolimo', moves: ['e4', 'c5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'B40', name: 'Sicilian: French Variation', moves: ['e4', 'c5', 'Nf3', 'e6'] },
  { eco: 'B50', name: 'Sicilian: Modern Variations', moves: ['e4', 'c5', 'Nf3', 'd6'] },
  { eco: 'B70', name: 'Sicilian: Dragon', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'] },
  { eco: 'B90', name: 'Sicilian: Najdorf', moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'] },
  { eco: 'C00', name: 'French Defense', moves: ['e4', 'e6'] },
  { eco: 'C02', name: 'French: Advance', moves: ['e4', 'e6', 'd4', 'd5', 'e5'] },
  { eco: 'C03', name: 'French: Tarrasch', moves: ['e4', 'e6', 'd4', 'd5', 'Nd2'] },
  { eco: 'C10', name: 'French: Paulsen', moves: ['e4', 'e6', 'd4', 'd5', 'Nc3'] },
  { eco: 'C20', name: 'King\'s Pawn Game', moves: ['e4', 'e5'] },
  { eco: 'C20', name: 'Bishop\'s Opening', moves: ['e4', 'e5', 'Bc4'] },
  { eco: 'C23', name: 'Bishop\'s Opening', moves: ['e4', 'e5', 'Bc4'] },
  { eco: 'C25', name: 'Vienna Game', moves: ['e4', 'e5', 'Nc3'] },
  { eco: 'C30', name: 'King\'s Gambit', moves: ['e4', 'e5', 'f4'] },
  { eco: 'C40', name: 'King\'s Knight Opening', moves: ['e4', 'e5', 'Nf3'] },
  { eco: 'C41', name: 'Philidor Defense', moves: ['e4', 'e5', 'Nf3', 'd6'] },
  { eco: 'C42', name: 'Petrov\'s Defense', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { eco: 'C44', name: 'Scotch Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
  { eco: 'C45', name: 'Scotch Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'] },
  { eco: 'C47', name: 'Four Knights Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'] },
  { eco: 'C50', name: 'Italian Game', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { eco: 'C53', name: 'Giuoco Piano', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] },
  { eco: 'C55', name: 'Italian: Two Knights', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] },
  { eco: 'C60', name: 'Ruy López', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { eco: 'C65', name: 'Ruy López: Berlin Defense', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6'] },
  { eco: 'C68', name: 'Ruy López: Exchange', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6'] },
  { eco: 'C70', name: 'Ruy López: Morphy', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'] },
  { eco: 'C78', name: 'Ruy López: Closed', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'] },
  { eco: 'D00', name: "Queen's Pawn Game", moves: ['d4', 'd5'] },
  { eco: 'D02', name: "Queen's Pawn: Nf3", moves: ['d4', 'd5', 'Nf3'] },
  { eco: 'D04', name: 'Colle System', moves: ['d4', 'd5', 'Nf3', 'Nf6', 'e3'] },
  { eco: 'D06', name: "Queen's Gambit", moves: ['d4', 'd5', 'c4'] },
  { eco: 'D07', name: "Queen's Gambit: Chigorin", moves: ['d4', 'd5', 'c4', 'Nc6'] },
  { eco: 'D08', name: 'Albin Countergambit', moves: ['d4', 'd5', 'c4', 'e5'] },
  { eco: 'D10', name: 'Slav Defense', moves: ['d4', 'd5', 'c4', 'c6'] },
  { eco: 'D20', name: "Queen's Gambit Accepted", moves: ['d4', 'd5', 'c4', 'dxc4'] },
  { eco: 'D30', name: "Queen's Gambit Declined", moves: ['d4', 'd5', 'c4', 'e6'] },
  { eco: 'D35', name: 'QGD: Exchange', moves: ['d4', 'd5', 'c4', 'e6', 'cxd5', 'exd5'] },
  { eco: 'D43', name: 'Semi-Slav Defense', moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'e6'] },
  { eco: 'D50', name: 'QGD: Orthodox', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5'] },
  { eco: 'D70', name: 'Neo-Grünfeld Defense', moves: ['d4', 'Nf6', 'c4', 'g6', 'f3'] },
  { eco: 'D80', name: 'Grünfeld Defense', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'] },
  { eco: 'E00', name: 'Catalan Opening', moves: ['d4', 'Nf6', 'c4', 'e6', 'g3'] },
  { eco: 'E10', name: 'Indian Game: Anti-Nimzo', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3'] },
  { eco: 'E11', name: 'Bogo-Indian Defense', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'Bb4+'] },
  { eco: 'E12', name: 'Queen\'s Indian Defense', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'] },
  { eco: 'E20', name: 'Nimzo-Indian Defense', moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'] },
  { eco: 'E60', name: 'King\'s Indian Defense', moves: ['d4', 'Nf6', 'c4', 'g6'] },
  { eco: 'E61', name: 'King\'s Indian: Normal', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'] },
  { eco: 'E90', name: 'King\'s Indian: Classical', moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3'] },
];

export function identifyOpening(moves: string[]): Opening | null {
  if (moves.length === 0) return null;
  let best: Opening | null = null;
  for (const opening of OPENINGS) {
    if (opening.moves.length === 0) continue;
    if (moves.length < opening.moves.length) continue;
    const matches = opening.moves.every((m, i) => moves[i] === m);
    if (matches) {
      if (!best || opening.moves.length > best.moves.length) {
        best = opening;
      }
    }
  }
  return best;
}
