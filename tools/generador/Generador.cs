using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;

// Generador de población penitenciaria SIMULADA calibrada con el
// Informe Estadístico INPE - Enero 2026. Todos los datos personales son ficticios.
public static class Generador
{
    // ------------------------------------------------------------------ modelos
    public class Penal
    {
        public string Id, Nombre, Oficina, Departamento, Ubigeo;
        public int Cap, HP, MP, HS, MS;
        public List<Pab> Pabs = new List<Pab>();
        public int Pop { get { return HP + MP + HS + MS; } }
        public int Hombres { get { return HP + HS; } }
        public int Mujeres { get { return MP + MS; } }
    }
    public class Pab { public string Id, Nombre; public char Sexo; public int Cap, Pop; }
    public class Delito
    {
        public string Id, Nombre, Art; public int Total, Proc, Sent; public int[] Ages;
        public double Sev, FemW; public bool Perp;
    }
    public class Sub { public string Id, Nombre, Art; public double W, Sev; public bool Perp; }
    public class Interno
    {
        public int N; public Penal P; public Pab Pb; public char Sexo; public bool Proc;
        public Delito D; public Sub S; public int AgeGroup, Edad; public DateTime Nac;
        public int Ingresos; public string EstadoCivil, Instruccion, Nacionalidad = "PERUANA";
        public string TipoDoc, NumDoc, Nombres, ApPat, ApMat, Expediente;
        public DateTime FIngreso; public int PlazoPP; public DateTime FVencPP; public bool PPProlongada;
        public DateTime FSentencia; public int PenaMeses; public bool Perpetua; public DateTime FLiberacion;
        public double Score;
    }

    static Random R;
    static readonly DateTime REF = new DateTime(2026, 1, 31);

    // ------------------------------------------------------------------ utilidades
    static double U() { return R.NextDouble(); }
    static double Gauss() { double u1 = 1.0 - U(), u2 = U(); return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2 * Math.PI * u2); }
    static int Pick(double[] w)
    {
        double s = 0; for (int i = 0; i < w.Length; i++) s += w[i];
        double x = U() * s;
        for (int i = 0; i < w.Length; i++) { x -= w[i]; if (x <= 0) return i; }
        return w.Length - 1;
    }
    static T PickW<T>(IList<T> items, Func<T, double> w)
    {
        double[] ws = items.Select(w).ToArray(); return items[Pick(ws)];
    }
    static void Shuffle<T>(IList<T> l) { for (int i = l.Count - 1; i > 0; i--) { int j = R.Next(i + 1); T t = l[i]; l[i] = l[j]; l[j] = t; } }
    // Reparto entero por mayor resto
    static int[] Alloc(int total, double[] w, int min)
    {
        int n = w.Length; int[] r = new int[n];
        int rest = total - min * n; if (rest < 0) { min = 0; rest = total; }
        double s = w.Sum(); double[] exact = new double[n];
        int used = 0;
        for (int i = 0; i < n; i++) { exact[i] = rest * w[i] / s; r[i] = min + (int)Math.Floor(exact[i]); used += (int)Math.Floor(exact[i]); }
        var order = Enumerable.Range(0, n).OrderByDescending(i => exact[i] - Math.Floor(exact[i])).ToList();
        for (int k = 0; k < rest - used; k++) r[order[k % n]]++;
        return r;
    }
    static string Esc(string s)
    {
        if (s == null) return "null";
        var sb = new StringBuilder("\"");
        foreach (char c in s) { if (c == '"' || c == '\\') sb.Append('\\'); sb.Append(c); }
        return sb.Append('"').ToString();
    }
    static string D(DateTime d) { return "{\"$date\":\"" + d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "T00:00:00Z\"}"; }
    static string Num(double d) { return d.ToString("0.##", CultureInfo.InvariantCulture); }

    // ------------------------------------------------------------------ datos INPE (Anexos 04 y 06)
    static List<Penal> Penales()
    {
        var L = new List<Penal>();
        Action<string, string, string, string, int, int, int, int, int> A = (of, dep, ub, nom, cap, hp, mp, hs, ms) =>
            L.Add(new Penal { Oficina = of, Departamento = dep, Ubigeo = ub, Nombre = nom, Cap = cap, HP = hp, MP = mp, HS = hs, MS = ms });
        // Norte
        A("Norte", "Tumbes", "24", "E.P. de Tumbes", 576, 386, 0, 901, 0);
        A("Norte", "Piura", "20", "E.P. de Piura", 1370, 2359, 0, 2085, 0);
        A("Norte", "Piura", "20", "E.P. de Sullana", 194, 0, 149, 0, 79);
        A("Norte", "Lambayeque", "14", "E.P. de Chiclayo", 1143, 1682, 1, 2436, 0);
        A("Norte", "La Libertad", "13", "E.P. de Trujillo", 1518, 1602, 0, 4706, 0);
        A("Norte", "La Libertad", "13", "E.P. de Mujeres de Trujillo", 296, 0, 188, 0, 397);
        A("Norte", "La Libertad", "13", "E.P. de Pacasmayo", 72, 0, 26, 0, 81);
        A("Norte", "Cajamarca", "06", "E.P. de Cajamarca", 1512, 622, 68, 1619, 118);
        A("Norte", "Cajamarca", "06", "E.P. de Chota", 65, 28, 1, 118, 0);
        A("Norte", "Cajamarca", "06", "E.P. de Jaén", 50, 63, 3, 146, 3);
        A("Norte", "Cajamarca", "06", "E.P. de San Ignacio", 150, 31, 4, 31, 0);
        // Lima
        A("Lima", "Áncash", "02", "E.P. de Huaraz", 598, 649, 29, 568, 20);
        A("Lima", "Áncash", "02", "E.P. de Chimbote", 1144, 1567, 88, 1603, 69);
        A("Lima", "Callao", "07", "E.P. del Callao", 572, 920, 0, 2069, 0);
        A("Lima", "Callao", "07", "CEREC - Base Naval", 8, 1, 0, 4, 0);
        A("Lima", "Lima", "15", "E.P. de Mujeres de Chorrillos", 450, 0, 371, 0, 442);
        A("Lima", "Lima", "15", "E.P. Anexo de Mujeres de Chorrillos", 288, 0, 491, 0, 197);
        A("Lima", "Lima", "15", "E.P. de Lurigancho", 3204, 4384, 0, 5629, 0);
        A("Lima", "Lima", "15", "E.P. Miguel Castro Castro", 1142, 1906, 0, 3526, 0);
        A("Lima", "Lima", "15", "E.P. Virgen de Fátima", 548, 0, 35, 0, 346);
        A("Lima", "Lima", "15", "E.P. de Ancón", 1620, 873, 0, 1577, 0);
        A("Lima", "Lima", "15", "E.P. de Barbadillo", 3, 3, 0, 1, 0);
        A("Lima", "Lima", "15", "E.P. Modelo Ancón II - S.M.V.C.", 2216, 279, 0, 1719, 0);
        A("Lima", "Lima", "15", "E.P. Virgen de la Merced", 42, 9, 0, 25, 0);
        A("Lima", "Lima", "15", "E.P. de Huacho", 644, 436, 33, 1694, 53);
        A("Lima", "Lima", "15", "E.P. de Cañete", 1024, 2260, 0, 1661, 0);
        A("Lima", "Lima", "15", "E.P. de Huaral", 1029, 1827, 0, 2004, 0);
        A("Lima", "Ica", "11", "E.P. de Ica", 1924, 2277, 48, 2987, 87);
        A("Lima", "Ica", "11", "E.P. de Chincha", 1152, 1347, 91, 2084, 51);
        // Sur
        A("Sur", "Arequipa", "04", "E.P. de Arequipa", 667, 496, 0, 1977, 0);
        A("Sur", "Arequipa", "04", "E.P. de Mujeres de Arequipa", 67, 0, 42, 0, 128);
        A("Sur", "Arequipa", "04", "E.P. de Camaná", 78, 152, 6, 233, 1);
        A("Sur", "Moquegua", "18", "E.P. de Moquegua", 178, 87, 6, 259, 10);
        A("Sur", "Tacna", "23", "E.P. de Tacna", 222, 468, 0, 727, 0);
        A("Sur", "Tacna", "23", "E.P. de Mujeres de Tacna", 40, 0, 50, 0, 66);
        // Centro
        A("Centro", "Junín", "12", "E.P. de Huancayo", 680, 381, 0, 2005, 0);
        A("Centro", "Junín", "12", "E.P. de Mujeres de Concepción", 105, 0, 17, 0, 34);
        A("Centro", "Junín", "12", "E.P. de Chanchamayo", 120, 209, 0, 343, 0);
        A("Centro", "Junín", "12", "E.P. de Jauja", 373, 0, 113, 0, 87);
        A("Centro", "Junín", "12", "E.P. de Tarma", 48, 37, 0, 99, 0);
        A("Centro", "Junín", "12", "E.P. de La Oroya", 64, 25, 0, 76, 0);
        A("Centro", "Junín", "12", "E.P. de Río Negro", 216, 150, 0, 708, 0);
        A("Centro", "Huancavelica", "09", "E.P. de Huancavelica", 60, 83, 0, 207, 0);
        A("Centro", "Ayacucho", "05", "E.P. de Ayacucho", 644, 544, 0, 2097, 0);
        A("Centro", "Ayacucho", "05", "E.P. de Huanta", 42, 0, 33, 0, 113);
        // Oriente
        A("Oriente", "Huánuco", "10", "E.P. de Huánuco", 1344, 1004, 70, 2056, 89);
        A("Oriente", "Pasco", "19", "E.P. de Cerro de Pasco", 96, 0, 22, 0, 51);
        A("Oriente", "Pasco", "19", "E.P. de Cochamarca", 1224, 325, 0, 729, 0);
        A("Oriente", "Ucayali", "25", "E.P. de Pucallpa", 576, 965, 55, 1776, 71);
        // Sur Oriente
        A("Sur Oriente", "Apurímac", "03", "E.P. de Abancay", 90, 197, 4, 253, 18);
        A("Sur Oriente", "Apurímac", "03", "E.P. de Andahuaylas", 248, 247, 4, 337, 28);
        A("Sur Oriente", "Cusco", "08", "E.P. de Cusco", 1616, 1037, 0, 2565, 0);
        A("Sur Oriente", "Cusco", "08", "E.P. de Mujeres de Cusco", 198, 0, 75, 0, 143);
        A("Sur Oriente", "Cusco", "08", "E.P. de Sicuani", 96, 97, 0, 163, 0);
        A("Sur Oriente", "Cusco", "08", "E.P. de Quillabamba", 80, 112, 6, 216, 18);
        A("Sur Oriente", "Madre de Dios", "17", "E.P. de Puerto Maldonado", 590, 636, 34, 561, 39);
        // Nor Oriente
        A("Nor Oriente", "San Martín", "22", "E.P. de Moyobamba", 675, 294, 11, 651, 23);
        A("Nor Oriente", "San Martín", "22", "E.P. de Juanjuí", 970, 295, 12, 652, 21);
        A("Nor Oriente", "San Martín", "22", "E.P. de Tarapoto", 222, 245, 0, 177, 0);
        A("Nor Oriente", "San Martín", "22", "E.P. de Sananguillo", 966, 122, 15, 702, 25);
        A("Nor Oriente", "Loreto", "16", "E.P. de Iquitos", 1392, 620, 0, 759, 0);
        A("Nor Oriente", "Loreto", "16", "E.P. de Mujeres de Iquitos", 78, 0, 43, 0, 38);
        A("Nor Oriente", "Loreto", "16", "E.P. de Yurimaguas", 406, 167, 7, 237, 8);
        A("Nor Oriente", "Amazonas", "01", "E.P. de Chachapoyas", 732, 157, 6, 684, 34);
        A("Nor Oriente", "Amazonas", "01", "E.P. de Bagua Grande", 119, 239, 19, 156, 8);
        // Altiplano
        A("Altiplano", "Puno", "21", "E.P. de Puno", 1002, 203, 0, 1015, 0);
        A("Altiplano", "Puno", "21", "E.P. de Lampa", 252, 0, 50, 0, 167);
        A("Altiplano", "Puno", "21", "E.P. de Juliaca", 420, 389, 0, 894, 0);
        A("Altiplano", "Tacna", "23", "E.P. de Challapalca", 214, 104, 0, 123, 0);
        for (int i = 0; i < L.Count; i++) L[i].Id = "EP" + (i + 1).ToString("00");
        return L;
    }

    // Delitos específicos x situación jurídica x rango de edad (INPE pp. 25-26)
    // Edades: 16-17,18-19,20-24,25-29,30-34,35-39,40-44,45-49,50-54,55-59,60+
    static List<Delito> Delitos()
    {
        var L = new List<Delito>();
        Action<string, string, int, int, int, double, double, bool, int[]> A = (nom, art, tot, pr, se, sev, fem, perp, ages) =>
            L.Add(new Delito { Nombre = nom, Art = art, Total = tot, Proc = pr, Sent = se, Sev = sev, FemW = fem, Perp = perp, Ages = ages });
        A("Robo agravado", "189", 21643, 7238, 14405, 6.0, 1.0, true, new[] { 36, 254, 2690, 4909, 5267, 3484, 2236, 1331, 786, 373, 277 });
        A("Violación sexual de menor de edad", "173", 12270, 2974, 9296, 9.5, 0.01, true, new[] { 2, 20, 332, 853, 1399, 1644, 1770, 1666, 1450, 1166, 1968 });
        A("Tráfico ilícito de drogas", "296", 8129, 3429, 4700, 5.0, 5.0, false, new[] { 6, 29, 582, 1285, 1439, 1212, 990, 871, 634, 479, 602 });
        A("Robo agravado grado tentativa", "189 (con art. 16)", 5451, 1901, 3550, 4.0, 0.8, false, new[] { 7, 57, 867, 1512, 1313, 740, 478, 261, 117, 54, 45 });
        A("Promoción o favorecimiento al tráfico ilícito de drogas", "296", 4248, 1324, 2924, 5.0, 5.0, false, new[] { 1, 11, 218, 660, 802, 660, 577, 479, 326, 238, 276 });
        A("Violación sexual", "170", 3998, 1331, 2667, 7.0, 0.01, false, new[] { 1, 8, 152, 395, 498, 509, 564, 521, 444, 355, 551 });
        A("Tráfico ilícito de drogas - formas agravadas", "297", 3729, 1329, 2400, 7.0, 5.0, false, new[] { 0, 7, 147, 485, 645, 664, 487, 458, 321, 238, 277 });
        A("Homicidio calificado - asesinato", "108", 3406, 1085, 2321, 8.5, 0.5, true, new[] { 2, 35, 237, 461, 583, 538, 472, 414, 266, 172, 226 });
        A("Actos contra el pudor en menores de 14 años", "176-A", 2890, 820, 2070, 7.0, 0.01, false, new[] { 0, 3, 18, 98, 215, 323, 416, 431, 391, 322, 673 });
        A("Hurto agravado", "186", 2835, 1032, 1803, 3.0, 1.5, false, new[] { 0, 12, 201, 506, 651, 488, 394, 257, 152, 106, 68 });
        A("Incumplimiento de la obligación alimentaria", "149", 2469, 638, 1831, 0.5, 0.3, false, new[] { 0, 0, 14, 157, 399, 509, 578, 395, 232, 116, 69 });
        A("Tocamientos, actos de connotación sexual o actos libidinosos en agravio de menores", "176-A", 2242, 1179, 1063, 6.0, 0.01, false, new[] { 0, 6, 86, 184, 283, 308, 266, 265, 285, 191, 368 });
        A("Tenencia ilegal de armas", "279", 1975, 916, 1059, 3.0, 0.3, false, new[] { 4, 20, 201, 392, 480, 323, 236, 157, 82, 48, 32 });
        A("Fabricación, comercialización, uso o porte de armas", "279-G", 1676, 1113, 563, 3.0, 0.3, false, new[] { 3, 25, 224, 456, 391, 256, 163, 74, 51, 21, 12 });
        A("Extorsión", "200", 1498, 858, 640, 6.0, 1.0, true, new[] { 6, 37, 193, 278, 307, 238, 172, 108, 96, 31, 32 });
        A("Hurto agravado - grado tentativa", "186 (con art. 16)", 1283, 359, 924, 2.0, 1.5, false, new[] { 0, 1, 84, 232, 286, 247, 182, 108, 70, 39, 34 });
        A("Violación sexual de persona en estado de inconsciencia o en la imposibilidad de resistir", "171", 1052, 420, 632, 7.0, 0.01, false, new[] { 2, 14, 54, 119, 130, 144, 135, 123, 103, 89, 139 });
        A("Agresiones contra la mujer o integrantes del grupo familiar", "122-B", 967, 273, 694, 1.5, 0.2, false, new[] { 0, 0, 36, 117, 179, 185, 146, 144, 71, 51, 38 });
        A("Feminicidio", "108-B", 966, 293, 673, 8.5, 0.0, true, new[] { 0, 2, 37, 108, 159, 169, 170, 115, 91, 50, 65 });
        A("Tenencia ilegal de armas de fuego, municiones y explosivos", "279", 944, 474, 470, 3.0, 0.3, false, new[] { 1, 15, 114, 240, 230, 133, 101, 55, 25, 21, 9 });
        A("Otros delitos", "varios", 20046, 8938, 11108, 4.0, 1.5, false, new[] { 31, 150, 1400, 2708, 3489, 3067, 2824, 2198, 1597, 1138, 1444 });
        for (int i = 0; i < L.Count; i++) L[i].Id = "DEL" + (i + 1).ToString("00");
        return L;
    }

    // Desagregación ESTIMADA de "Otros delitos" (el INPE no la publica)
    static List<Sub> Subdelitos()
    {
        var L = new List<Sub>();
        Action<string, string, double, double, bool> A = (n, a, w, s, p) => L.Add(new Sub { Nombre = n, Art = a, W = w, Sev = s, Perp = p });
        A("Microcomercialización o microproducción de drogas", "298", 933, 3.0, false);
        A("Homicidio simple", "106", 1800, 6.0, false);
        A("Lesiones graves", "121", 1500, 4.0, false);
        A("Secuestro", "152", 900, 8.0, true);
        A("Robo", "188", 1600, 3.0, false);
        A("Receptación", "194", 1200, 2.5, false);
        A("Estafa", "196", 900, 2.5, false);
        A("Organización criminal", "317", 1500, 6.0, false);
        A("Usurpación", "202", 600, 2.0, false);
        A("Trata de personas", "153", 700, 7.5, false);
        A("Homicidio culposo", "111", 400, 2.0, false);
        A("Peculado", "387", 500, 4.0, false);
        A("Colusión", "384", 400, 4.0, false);
        A("Conducción en estado de ebriedad o drogadicción", "274", 300, 1.0, false);
        A("Violencia y resistencia a la autoridad", "366", 900, 2.5, false);
        A("Falsificación de documentos", "427", 700, 2.5, false);
        A("Parricidio", "107", 400, 8.0, false);
        A("Sicariato", "108-C", 600, 9.0, true);
        A("Marcaje o reglaje", "317-A", 300, 4.0, false);
        A("Lavado de activos", "D. Leg. 1106", 500, 6.0, false);
        A("Favorecimiento a la prostitución / proxenetismo", "179", 300, 4.0, false);
        A("Abigeato", "189-A", 500, 3.0, false);
        for (int i = 0; i < L.Count; i++) L[i].Id = "DEL21-" + (i + 1).ToString("00");
        return L;
    }

    // ------------------------------------------------------------------ nombres (ficticios)
    static readonly string[] NomH = { "José", "Luis", "Juan", "Carlos", "Jorge", "Miguel", "César", "Víctor", "Pedro", "Javier", "Manuel", "Jesús", "Alex", "Julio", "Ricardo", "Daniel", "David", "Wilmer", "Edwin", "Roberto", "Fernando", "Raúl", "Walter", "Óscar", "Alberto", "Héctor", "Marco", "Kevin", "Brayan", "Jhon", "Diego", "Renzo", "Cristian", "Christian", "Anthony", "Jhonatan", "Elmer", "Segundo", "Wilson", "Percy", "Rolando", "Hugo", "Eduardo", "Andrés", "Franklin", "Fredy", "Ángel", "Junior", "Joel", "Abel", "Santos", "Teodoro", "Hilario", "Mario", "Enrique", "Gustavo", "Iván", "Sergio", "Martín", "Rubén", "Nilton", "Edgar", "Henry", "Gerson", "Yordy", "Erick", "Jimmy", "Richard", "Alfredo", "Felipe", "Gabriel", "Samuel", "Lucio", "Florencio", "Eusebio", "Teófilo", "Rómulo", "Isaac", "Moisés", "Saúl" };
    static readonly string[] NomM = { "María", "Rosa", "Ana", "Carmen", "Juana", "Luz", "Elizabeth", "Milagros", "Gladys", "Patricia", "Yolanda", "Silvia", "Flor", "Karina", "Lucía", "Diana", "Sandra", "Jessica", "Katherine", "Yesenia", "Marleny", "Maribel", "Nancy", "Elena", "Julia", "Teresa", "Sonia", "Rocío", "Ruth", "Gabriela", "Vanessa", "Fiorella", "Sheyla", "Lizbeth", "Mónica", "Pilar", "Esther", "Martha", "Norma", "Haydee", "Nelly", "Delia", "Isabel", "Verónica", "Mercedes", "Angélica", "Roxana", "Lourdes", "Margarita", "Victoria", "Andrea", "Daniela", "Melissa", "Brenda", "Yaneth", "Edith", "Susana", "Cecilia", "Beatriz", "Raquel" };
    static readonly string[] Ap = { "García", "Rodríguez", "López", "Sánchez", "Flores", "Rojas", "Díaz", "Torres", "Ramírez", "Pérez", "Vásquez", "Chávez", "Gonzales", "Ramos", "Castillo", "Mendoza", "Ruiz", "Gutiérrez", "Fernández", "Castro", "Romero", "Reyes", "Herrera", "Espinoza", "Salazar", "Cruz", "Vargas", "Morales", "Ortiz", "Silva", "Jiménez", "Medina", "Aguilar", "Paredes", "Córdova", "Vega", "Rivera", "Cabrera", "Muñoz", "Delgado", "Valdivia", "Salas", "Campos", "Cárdenas", "Navarro", "Ríos", "Alvarado", "Benites", "Soto", "Peña", "Guerrero", "Zapata", "Arias", "Carrasco", "Valverde", "Saavedra", "Montoya", "Palacios", "Barrios", "Acosta", "Villanueva", "Zevallos", "Miranda", "Bravo", "Tello", "Fuentes", "Cueva", "Inga", "Lozano", "Rengifo", "Pinedo", "Panduro", "Tuesta", "Del Águila", "Arévalo", "Pizarro", "Guevara", "Meza", "Calderón", "Cáceres", "Ortega", "Correa", "Sandoval", "Ponce", "Lazo", "Dávila", "Rosales", "Huerta", "Infante", "Olivares" };
    static readonly string[] ApAndino = { "Quispe", "Mamani", "Huamán", "Condori", "Ccahuana", "Choque", "Apaza", "Ticona", "Huanca", "Ccama", "Chambi", "Coaquira", "Cusi", "Yupanqui", "Inca", "Huaman", "Pari", "Puma", "Nina", "Taipe", "Cutipa", "Calla", "Laura", "Arce", "Soncco", "Layme", "Ayala", "Poma", "Llanos", "Yauri", "Cconislla", "Huillca", "Turpo", "Quispe", "Mamani", "Condori" };
    static readonly string[] Paises = { "VENEZOLANA", "COLOMBIANA", "ECUATORIANA", "BOLIVIANA", "CHILENA", "MEXICANA", "ESPAÑOLA", "BRASILEÑA", "DOMINICANA", "ESTADOUNIDENSE", "SUDAFRICANA", "NIGERIANA", "CHINA", "MALASIA" };
    static readonly double[] PaisW = { 62, 14, 7, 3, 2.5, 2, 1.5, 1.5, 1.5, 1, 1.2, 1.3, 1, 0.5 };
    static readonly Dictionary<string, string[][]> NombresExt = new Dictionary<string, string[][]> {
        { "BRASILEÑA", new[] { new[] { "João", "Pedro", "Lucas", "Gabriel", "Rafael", "Thiago" }, new[] { "Ana", "Beatriz", "Juliana", "Camila" }, new[] { "Silva", "Santos", "Oliveira", "Souza", "Costa", "Pereira" } } },
        { "ESTADOUNIDENSE", new[] { new[] { "John", "Michael", "David", "James", "Robert" }, new[] { "Jennifer", "Ashley", "Sarah", "Emily" }, new[] { "Smith", "Johnson", "Brown", "Miller", "Davis" } } },
        { "SUDAFRICANA", new[] { new[] { "Thabo", "Sipho", "Johan", "Pieter", "Lungile" }, new[] { "Naledi", "Zanele", "Anika", "Thandi" }, new[] { "Nkosi", "Dlamini", "Van der Merwe", "Botha", "Mokoena" } } },
        { "NIGERIANA", new[] { new[] { "Chukwuemeka", "Oluwaseun", "Ibrahim", "Emeka", "Tunde" }, new[] { "Ngozi", "Chioma", "Aisha", "Funmilayo" }, new[] { "Okafor", "Adeyemi", "Okonkwo", "Bello", "Eze" } } },
        { "CHINA", new[] { new[] { "Wei", "Jun", "Hao", "Lei", "Ming" }, new[] { "Li Na", "Mei", "Xiu", "Yan" }, new[] { "Wang", "Li", "Zhang", "Liu", "Chen" } } },
        { "MALASIA", new[] { new[] { "Ahmad", "Muhammad", "Hafiz", "Azlan" }, new[] { "Nur", "Siti", "Aisyah" }, new[] { "Abdullah", "Ismail", "Rahman", "Hassan" } } }
    };

    // ------------------------------------------------------------------ generación
    public static string Run(string outDir, int seed)
    {
        R = new Random(seed);
        Directory.CreateDirectory(outDir);
        var log = new StringBuilder();
        var penales = Penales(); var delitos = Delitos(); var subs = Subdelitos();

        // --- verificación de insumos
        int tot = penales.Sum(p => p.Pop), cap = penales.Sum(p => p.Cap), proc = penales.Sum(p => p.HP + p.MP);
        int hom = penales.Sum(p => p.Hombres), muj = penales.Sum(p => p.Mujeres);
        if (penales.Count != 69 || tot != 103717 || cap != 41764 || proc != 37924 || hom != 98228 || muj != 5489)
            throw new Exception(string.Format("Insumos de penales no cuadran: n={0} tot={1} cap={2} proc={3} H={4} M={5}", penales.Count, tot, cap, proc, hom, muj));
        foreach (var d in delitos)
            if (d.Proc + d.Sent != d.Total || d.Ages.Sum() != d.Total) throw new Exception("Delito no cuadra: " + d.Nombre);
        if (delitos.Sum(d => d.Total) != 103717 || delitos.Sum(d => d.Proc) != 37924) throw new Exception("Totales de delitos no cuadran");

        // --- 1. internos por penal con sexo y situación jurídica exactos
        var I = new List<Interno>(tot);
        foreach (var p in penales)
        {
            for (int k = 0; k < p.HP; k++) I.Add(new Interno { P = p, Sexo = 'M', Proc = true });
            for (int k = 0; k < p.MP; k++) I.Add(new Interno { P = p, Sexo = 'F', Proc = true });
            for (int k = 0; k < p.HS; k++) I.Add(new Interno { P = p, Sexo = 'M', Proc = false });
            for (int k = 0; k < p.MS; k++) I.Add(new Interno { P = p, Sexo = 'F', Proc = false });
        }

        // --- 2. pabellones (SIMULADOS: el INPE no publica datos por pabellón)
        foreach (var p in penales)
        {
            var men = I.Where(x => x.P == p && x.Sexo == 'M').ToList();
            var wom = I.Where(x => x.P == p && x.Sexo == 'F').ToList();
            bool mixto = men.Count > 0 && wom.Count > 0;
            int capF = 0;
            if (mixto) capF = Math.Max(5, (int)Math.Round(p.Cap * (double)wom.Count / p.Pop));
            int capMain = p.Cap - capF;
            char sexoMain = men.Count > 0 ? 'M' : 'F';
            int n = capMain < 80 ? 1 : capMain < 200 ? 2 : Math.Min(16, Math.Max(2, (int)Math.Round(capMain / 220.0)));
            double[] wc = Enumerable.Range(0, n).Select(i => 0.6 + 0.8 * U()).ToArray();
            int[] caps = Alloc(capMain, wc, Math.Min(5, capMain / Math.Max(1, n)));
            for (int i = 0; i < n; i++)
                p.Pabs.Add(new Pab { Id = p.Id + "-P" + (i + 1).ToString("00"), Nombre = "Pabellón " + (sexoMain == 'F' ? ((char)('A' + i)).ToString() : (i + 1).ToString()), Sexo = sexoMain, Cap = caps[i] });
            var mainPeople = sexoMain == 'M' ? men : wom;
            double[] wp = p.Pabs.Select(b => b.Cap * (0.6 + 1.0 * U())).ToArray();
            int[] pops = Alloc(mainPeople.Count, wp, 0);
            Shuffle(mainPeople); int idx = 0;
            for (int i = 0; i < n; i++) { p.Pabs[i].Pop = pops[i]; for (int k = 0; k < pops[i]; k++) mainPeople[idx++].Pb = p.Pabs[i]; }
            if (mixto)
            {
                var pf = new Pab { Id = p.Id + "-PM", Nombre = "Pabellón de Mujeres", Sexo = 'F', Cap = capF, Pop = wom.Count };
                p.Pabs.Add(pf); foreach (var w in wom) w.Pb = pf;
            }
        }

        // --- 3. delitos: tabla delito x situación jurídica exacta; sesgo plausible por sexo
        foreach (bool sp in new[] { true, false })
        {
            int[] rem = delitos.Select(d => sp ? d.Proc : d.Sent).ToArray();
            var grupo = I.Where(x => x.Proc == sp).ToList();
            foreach (var x in grupo.Where(x => x.Sexo == 'F'))
            {
                int k = Pick(delitos.Select((d, i) => rem[i] * d.FemW).ToArray());
                x.D = delitos[k]; rem[k]--;
            }
            var bolsa = new List<Delito>();
            for (int i = 0; i < delitos.Count; i++) for (int k = 0; k < rem[i]; k++) bolsa.Add(delitos[i]);
            Shuffle(bolsa);
            var hombres = grupo.Where(x => x.Sexo == 'M').ToList();
            if (bolsa.Count != hombres.Count) throw new Exception("Bolsa de delitos no cuadra");
            for (int i = 0; i < hombres.Count; i++) hombres[i].D = bolsa[i];
        }
        foreach (var x in I.Where(x => x.D.Id == "DEL21")) x.S = PickW(subs, s => s.W);

        // --- 4. edad: tabla delito x rango de edad exacta
        int[][] rng = { new[] { 16, 17 }, new[] { 18, 19 }, new[] { 20, 24 }, new[] { 25, 29 }, new[] { 30, 34 }, new[] { 35, 39 }, new[] { 40, 44 }, new[] { 45, 49 }, new[] { 50, 54 }, new[] { 55, 59 }, new[] { 60, 90 } };
        foreach (var d in delitos)
        {
            var grupo = I.Where(x => x.D == d).ToList();
            var bolsa = new List<int>();
            for (int g = 0; g < 11; g++) for (int k = 0; k < d.Ages[g]; k++) bolsa.Add(g);
            Shuffle(bolsa);
            for (int i = 0; i < grupo.Count; i++)
            {
                var x = grupo[i]; x.AgeGroup = bolsa[i];
                x.Edad = bolsa[i] == 10 ? Math.Min(90, 60 + (int)(-Math.Log(1 - U()) * 6)) : R.Next(rng[bolsa[i]][0], rng[bolsa[i]][1] + 1);
                x.Nac = REF.AddYears(-x.Edad).AddDays(-R.Next(0, 365));
            }
        }

        // --- 5. penas (sentenciados): distribución exacta INPE p.27, correlacionada con la gravedad del delito
        var sent = I.Where(x => !x.Proc).ToList();
        foreach (var x in sent) x.Score = (x.S != null ? x.S.Sev : x.D.Sev) + Gauss() * 1.5;
        var elegibles = sent.Where(x => x.S != null ? x.S.Perp : x.D.Perp).OrderByDescending(x => x.Score).Take(2699).ToList();
        foreach (var x in elegibles) x.Perpetua = true;
        var resto = sent.Where(x => !x.Perpetua).ToList();
        foreach (var x in resto) x.Score = (x.S != null ? x.S.Sev : x.D.Sev) + Gauss() * 2.5;
        resto = resto.OrderBy(x => x.Score).ToList();
        var penas = new List<int>();
        Action<int, int, int> Br = (n, lo, hi) => { for (int k = 0; k < n; k++) { int m = R.Next(lo, hi + 1); if (U() < 0.7 && hi - lo >= 12) { int y = (int)Math.Round(m / 12.0) * 12; if (y >= lo && y <= hi) m = y; } penas.Add(m); } };
        Br(664, 3, 11); Br(4607 - 664, 12, 47); Br(6330 - 4607, 48, 59);
        Br(22454, 60, 120); Br(16214, 121, 180); Br(7347, 181, 240); Br(4061, 241, 300); Br(4149, 301, 360); Br(2539, 361, 420);
        penas.Sort();
        if (penas.Count != resto.Count) throw new Exception("Penas no cuadran: " + penas.Count + " vs " + resto.Count);
        for (int i = 0; i < resto.Count; i++) resto[i].PenaMeses = penas[i];

        // --- 6. fechas
        foreach (var x in I)
        {
            int maxMeses = x.Edad >= 18 ? (x.Edad - 18) * 12 + 6 : 12;
            if (x.Proc)
            {
                double r = U(); x.PlazoPP = r < 0.55 ? 9 : r < 0.90 ? 18 : 36;
                double t = Math.Min(maxMeses, x.PlazoPP * 1.15 * Math.Pow(U(), 0.9));
                x.FIngreso = REF.AddDays(-(int)(t * 30.44) - 1);
                if (t > x.PlazoPP) { x.PPProlongada = true; x.FVencPP = x.FIngreso.AddMonths((int)(x.PlazoPP * 1.5)); }
                else x.FVencPP = x.FIngreso.AddMonths(x.PlazoPP);
            }
            else if (x.Perpetua)
            {
                double t = Math.Min(maxMeses, 24 + U() * 276);
                x.FIngreso = REF.AddDays(-(int)(t * 30.44) - 1);
                x.FSentencia = x.FIngreso.AddDays(R.Next(120, Math.Max(121, Math.Min(900, (int)(t * 30.44)))));
                if (x.FSentencia > REF) x.FSentencia = REF.AddDays(-R.Next(1, 60));
            }
            else
            {
                double t = Math.Min(maxMeses, x.PenaMeses * (0.03 + 0.95 * U()));
                x.FIngreso = REF.AddDays(-(int)(t * 30.44) - 1);
                x.FLiberacion = x.FIngreso.AddMonths(x.PenaMeses);
                if (x.FLiberacion <= REF) x.FLiberacion = REF.AddDays(R.Next(1, 30));
                int maxD = (int)((REF - x.FIngreso).TotalDays);
                x.FSentencia = x.FIngreso.AddDays(maxD <= 2 ? 1 : R.Next(1, Math.Max(2, Math.Min(maxD, 720))));
            }
        }

        // --- 7. número de ingresos (exacto, p.28)
        var ingresos = new List<int>();
        int[] ingN = { 78576, 16210, 4995, 1976, 904, 453, 272, 331 };
        for (int g = 0; g < 8; g++) for (int k = 0; k < ingN[g]; k++) ingresos.Add(g == 7 ? 8 + (U() < 0.3 ? R.Next(1, 4) : 0) : g + 1);
        Shuffle(ingresos);
        for (int i = 0; i < I.Count; i++) I[i].Ingresos = ingresos[i];
        var mayores1 = I.Where(x => x.Edad >= 30 && x.Ingresos == 1).ToList(); Shuffle(mayores1); int mi = 0;
        foreach (var x in I.Where(x => x.Edad < 22 && x.Ingresos > 2)) { var y = mayores1[mi++]; y.Ingresos = x.Ingresos; x.Ingresos = 1; }

        // --- 8. estado civil por sexo (exacto, pp. 14-15)
        Action<char, int[]> EC = (sx, n) =>
        {
            string[] et = { "SOLTERO", "CONVIVIENTE", "CASADO", "SEPARADO", "DIVORCIADO", "VIUDO" };
            var bolsa = new List<string>(); for (int k = 0; k < 6; k++) for (int j = 0; j < n[k]; j++) bolsa.Add(et[k]);
            var g = I.Where(x => x.Sexo == sx).ToList(); Shuffle(bolsa);
            if (bolsa.Count != g.Count) throw new Exception("Estado civil no cuadra " + sx);
            for (int i = 0; i < g.Count; i++) g[i].EstadoCivil = bolsa[i];
            var solteros = g.Where(x => x.Edad >= 30 && x.EstadoCivil == "SOLTERO").ToList(); Shuffle(solteros); int si = 0;
            foreach (var x in g.Where(x => x.Edad < 22 && x.EstadoCivil != "SOLTERO" && x.EstadoCivil != "CONVIVIENTE")) { var y = solteros[si++]; y.EstadoCivil = x.EstadoCivil; x.EstadoCivil = "SOLTERO"; }
        };
        EC('M', new[] { 45517, 42458, 8210, 908, 516, 619 });
        EC('F', new[] { 3237, 1663, 336, 113, 64, 76 });

        // --- 9. grado de instrucción (primaria y secundaria exactos p.15; resto estimado)
        var ins = new List<string>();
        Action<string, int> Ins = (s, n) => { for (int k = 0; k < n; k++) ins.Add(s); };
        Ins("PRIMARIA", 19351); Ins("SECUNDARIA", 73341); Ins("SUPERIOR", 8800); Ins("SIN INSTRUCCIÓN", 2225);
        Shuffle(ins); for (int i = 0; i < I.Count; i++) I[i].Instruccion = ins[i];

        // --- 10. extranjeros (5,935: 5,515 H y 420 M; penales con dato publicado fijos)
        var fijo = new Dictionary<string, int> { { "E.P. de Lurigancho", 1287 }, { "E.P. de Huaral", 411 }, { "E.P. Anexo de Mujeres de Chorrillos", 101 }, { "E.P. de Mujeres de Chorrillos", 82 }, { "E.P. de Mujeres de Trujillo", 37 } };
        foreach (char sx in new[] { 'M', 'F' })
        {
            int objetivo = sx == 'M' ? 5515 : 420;
            var libres = penales.Where(p => !fijo.ContainsKey(p.Nombre) && (sx == 'M' ? p.Hombres : p.Mujeres) > 0).ToList();
            int yaFijo = penales.Where(p => fijo.ContainsKey(p.Nombre) && (sx == 'M' ? p.Hombres : p.Mujeres) > 0).Sum(p => fijo[p.Nombre]);
            double[] w = libres.Select(p => (sx == 'M' ? p.Hombres : p.Mujeres) * (p.Oficina == "Lima" ? 1.5 : (p.Departamento == "Tumbes" || p.Departamento == "Tacna" || p.Departamento == "Piura") ? 2.0 : 0.4)).ToArray();
            int[] cnt = Alloc(objetivo - yaFijo, w, 0);
            var asign = new Dictionary<Penal, int>();
            for (int i = 0; i < libres.Count; i++) asign[libres[i]] = cnt[i];
            foreach (var p in penales.Where(p => fijo.ContainsKey(p.Nombre) && (sx == 'M' ? p.Hombres : p.Mujeres) > 0)) asign[p] = fijo[p.Nombre];
            foreach (var kv in asign)
            {
                var g = I.Where(x => x.P == kv.Key && x.Sexo == sx && x.Edad >= 18).ToList(); Shuffle(g);
                for (int k = 0; k < Math.Min(kv.Value, g.Count); k++) g[k].Nacionalidad = Paises[Pick(PaisW)];
            }
        }

        // --- 11. identidad ficticia y expediente
        var docs = new HashSet<string>();
        var andino = new HashSet<string> { "Centro", "Sur Oriente", "Altiplano", "Sur" };
        int n_i = 0;
        foreach (var x in I)
        {
            x.N = ++n_i;
            if (x.Nacionalidad == "PERUANA")
            {
                x.TipoDoc = "DNI";
                // DNI correlacionado con año de nacimiento (más antiguos = número menor), único
                string dni;
                do
                {
                    double base_ = 5000000 + (x.Nac.Year - 1935) * 1000000.0;
                    long v = (long)(base_ + Gauss() * 3000000);
                    if (v < 1000000) v = 1000000 + R.Next(0, 1000000); if (v > 79999999) v = 79999999 - R.Next(0, 3000000);
                    dni = v.ToString("00000000");
                } while (!docs.Add(dni));
                x.NumDoc = dni;
                bool and = andino.Contains(x.P.Oficina);
                x.ApPat = (and && U() < 0.45) ? ApAndino[R.Next(ApAndino.Length)] : Ap[R.Next(Ap.Length)];
                x.ApMat = (and && U() < 0.45) ? ApAndino[R.Next(ApAndino.Length)] : Ap[R.Next(Ap.Length)];
                var pool = x.Sexo == 'M' ? NomH : NomM;
                x.Nombres = pool[R.Next(pool.Length)] + (U() < 0.55 ? " " + pool[R.Next(pool.Length)] : "");
            }
            else
            {
                string doc; do { doc = R.Next(1000000, 9999999).ToString("000000000"); } while (!docs.Add("CE" + doc));
                x.TipoDoc = U() < 0.7 ? "CARNÉ DE EXTRANJERÍA" : "PASAPORTE";
                x.NumDoc = x.TipoDoc == "PASAPORTE" ? ((char)('A' + R.Next(26))).ToString() + R.Next(1000000, 9999999).ToString() : doc;
                string[][] n3;
                if (NombresExt.TryGetValue(x.Nacionalidad, out n3))
                {
                    x.Nombres = (x.Sexo == 'M' ? n3[0] : n3[1])[R.Next((x.Sexo == 'M' ? n3[0] : n3[1]).Length)];
                    x.ApPat = n3[2][R.Next(n3[2].Length)]; x.ApMat = "";
                }
                else
                {
                    var pool = x.Sexo == 'M' ? NomH : NomM;
                    x.Nombres = pool[R.Next(pool.Length)] + (U() < 0.5 ? " " + pool[R.Next(pool.Length)] : "");
                    x.ApPat = Ap[R.Next(Ap.Length)]; x.ApMat = Ap[R.Next(Ap.Length)];
                }
            }
            int anioExp = Math.Max(2005, x.FIngreso.Year - (U() < 0.3 ? 1 : 0));
            x.Expediente = string.Format("{0:00000}-{1}-{2}-{3}01-JR-PE-{4:00}", R.Next(1, 20000), anioExp, R.Next(0, 3), x.P.Ubigeo, R.Next(1, 12));
        }

        // ------------------------------------------------------------------ salida (NDJSON / Extended JSON para mongoimport)
        var utf8 = new UTF8Encoding(false);
        using (var w = new StreamWriter(Path.Combine(outDir, "penales.json"), false, utf8))
            foreach (var p in penales)
                w.WriteLine("{\"_id\":" + Esc(p.Id) + ",\"nombre\":" + Esc(p.Nombre) + ",\"oficina_regional\":" + Esc(p.Oficina) + ",\"departamento\":" + Esc(p.Departamento) +
                    ",\"capacidad_albergue\":" + p.Cap + ",\"referencia_inpe_ene2026\":{\"poblacion\":" + p.Pop + ",\"hombres\":" + p.Hombres + ",\"mujeres\":" + p.Mujeres +
                    ",\"procesados\":" + (p.HP + p.MP) + ",\"sentenciados\":" + (p.HS + p.MS) + ",\"sobrepoblacion_pct\":" + Math.Round((p.Pop - p.Cap) * 100.0 / p.Cap) + "},\"activo\":true}");
        using (var w = new StreamWriter(Path.Combine(outDir, "pabellones.json"), false, utf8))
            foreach (var p in penales) foreach (var b in p.Pabs)
                    w.WriteLine("{\"_id\":" + Esc(b.Id) + ",\"penal_id\":" + Esc(p.Id) + ",\"nombre\":" + Esc(b.Nombre) + ",\"sexo\":" + Esc(b.Sexo.ToString()) + ",\"capacidad\":" + b.Cap + ",\"activo\":true}");
        using (var w = new StreamWriter(Path.Combine(outDir, "delitos.json"), false, utf8))
        {
            foreach (var d in delitos.Where(d => d.Id != "DEL21"))
                w.WriteLine("{\"_id\":" + Esc(d.Id) + ",\"nombre\":" + Esc(d.Nombre) + ",\"articulo_cp\":" + Esc(d.Art) + ",\"categoria_inpe\":" + Esc(d.Nombre) + "}");
            foreach (var s in subs)
                w.WriteLine("{\"_id\":" + Esc(s.Id) + ",\"nombre\":" + Esc(s.Nombre) + ",\"articulo_cp\":" + Esc(s.Art) + ",\"categoria_inpe\":\"Otros delitos\"}");
        }
        using (var w = new StreamWriter(Path.Combine(outDir, "internos.json"), false, utf8))
            foreach (var x in I)
            {
                var sb = new StringBuilder(1100);
                sb.Append("{\"codigo_interno\":").Append(Esc("INT-" + x.N.ToString("0000000")));
                sb.Append(",\"tipo_documento\":").Append(Esc(x.TipoDoc)).Append(",\"numero_documento\":").Append(Esc(x.NumDoc));
                sb.Append(",\"nombres\":").Append(Esc(x.Nombres)).Append(",\"apellido_paterno\":").Append(Esc(x.ApPat)).Append(",\"apellido_materno\":").Append(Esc(x.ApMat));
                sb.Append(",\"sexo\":").Append(Esc(x.Sexo.ToString())).Append(",\"fecha_nacimiento\":").Append(D(x.Nac)).Append(",\"edad\":").Append(x.Edad);
                sb.Append(",\"nacionalidad\":").Append(Esc(x.Nacionalidad)).Append(",\"estado_civil\":").Append(Esc(x.EstadoCivil)).Append(",\"grado_instruccion\":").Append(Esc(x.Instruccion));
                sb.Append(",\"ubicacion\":{\"penal_id\":").Append(Esc(x.P.Id)).Append(",\"pabellon_id\":").Append(Esc(x.Pb.Id)).Append("}");
                sb.Append(",\"situacion_juridica\":").Append(Esc(x.Proc ? "PROCESADO" : "SENTENCIADO"));
                string did = x.S != null ? x.S.Id : x.D.Id, dn = x.S != null ? x.S.Nombre : x.D.Nombre, da = x.S != null ? x.S.Art : x.D.Art;
                sb.Append(",\"delito\":{\"delito_id\":").Append(Esc(did)).Append(",\"nombre\":").Append(Esc(dn)).Append(",\"articulo_cp\":").Append(Esc(da)).Append(",\"categoria_inpe\":").Append(Esc(x.D.Nombre)).Append("}");
                sb.Append(",\"numero_expediente\":").Append(Esc(x.Expediente));
                sb.Append(",\"numero_ingresos\":").Append(x.Ingresos).Append(",\"condicion\":").Append(Esc(x.Ingresos == 1 ? "PRIMARIO" : "REINGRESANTE"));
                sb.Append(",\"fecha_ingreso\":").Append(D(x.FIngreso));
                if (x.Proc)
                    sb.Append(",\"prision_preventiva\":{\"plazo_meses\":").Append(x.PlazoPP).Append(",\"prolongada\":").Append(x.PPProlongada ? "true" : "false").Append(",\"fecha_vencimiento\":").Append(D(x.FVencPP)).Append("},\"sentencia\":null");
                else
                {
                    sb.Append(",\"prision_preventiva\":null,\"sentencia\":{\"fecha_sentencia\":").Append(D(x.FSentencia));
                    if (x.Perpetua) sb.Append(",\"cadena_perpetua\":true,\"pena_anios\":null,\"pena_meses\":null,\"fecha_liberacion_estimada\":null,\"fecha_revision_pena\":").Append(D(x.FIngreso.AddYears(35)));
                    else sb.Append(",\"cadena_perpetua\":false,\"pena_anios\":").Append(x.PenaMeses / 12).Append(",\"pena_meses\":").Append(x.PenaMeses % 12).Append(",\"fecha_liberacion_estimada\":").Append(D(x.FLiberacion));
                    sb.Append("}");
                }
                sb.Append(",\"dato_ficticio\":true}");
                w.WriteLine(sb.ToString());
            }

        // ------------------------------------------------------------------ informe de validación
        var val = new StringBuilder();
        val.AppendLine("# Validación: datos simulados vs. INPE (enero 2026)\n");
        val.AppendLine("Semilla: " + seed + " · Fecha de corte: 31/01/2026\n");
        val.AppendLine("| Indicador | Simulado | INPE |\n|---|---:|---:|");
        Action<string, int, int> F = (k, s, e) => val.AppendLine("| " + k + " | " + s.ToString("N0") + " | " + e.ToString("N0") + (s == e ? " ✔" : " ✘") + " |");
        F("Población intramuros", I.Count, 103717); F("Capacidad de albergue", penales.Sum(p => p.Pabs.Sum(b => b.Cap)), 41764);
        F("Hombres", I.Count(x => x.Sexo == 'M'), 98228); F("Mujeres", I.Count(x => x.Sexo == 'F'), 5489);
        F("Procesados", I.Count(x => x.Proc), 37924); F("Sentenciados", I.Count(x => !x.Proc), 65793);
        F("Cadena perpetua", I.Count(x => x.Perpetua), 2699);
        F("Penas < 4 años", I.Count(x => !x.Proc && !x.Perpetua && x.PenaMeses < 48), 4607);
        F("Penas < 1 año", I.Count(x => !x.Proc && !x.Perpetua && x.PenaMeses < 12), 664);
        F("Primarios (1 ingreso)", I.Count(x => x.Ingresos == 1), 78576);
        F("Extranjeros", I.Count(x => x.Nacionalidad != "PERUANA"), 5935);
        F("Solteros", I.Count(x => x.EstadoCivil == "SOLTERO"), 48754); F("Convivientes", I.Count(x => x.EstadoCivil == "CONVIVIENTE"), 44121);
        F("Instrucción primaria", I.Count(x => x.Instruccion == "PRIMARIA"), 19351); F("Instrucción secundaria", I.Count(x => x.Instruccion == "SECUNDARIA"), 73341);
        val.AppendLine("\n## Delitos x situación jurídica\n\n| Delito | Procesados | INPE | Sentenciados | INPE |\n|---|---:|---:|---:|---:|");
        foreach (var d in delitos)
        {
            int sp = I.Count(x => x.D == d && x.Proc), ss = I.Count(x => x.D == d && !x.Proc);
            val.AppendLine("| " + d.Nombre + " | " + sp + " | " + d.Proc + (sp == d.Proc ? " ✔" : " ✘") + " | " + ss + " | " + d.Sent + (ss == d.Sent ? " ✔" : " ✘") + " |");
        }
        val.AppendLine("\n## Penales: capacidad, población y sobrepoblación\n\n| Penal | Capacidad | Población simulada | INPE | % sobrepoblación |\n|---|---:|---:|---:|---:|");
        foreach (var p in penales)
        {
            int ps = I.Count(x => x.P == p);
            val.AppendLine("| " + p.Nombre + " | " + p.Cap + " | " + ps + " | " + p.Pop + (ps == p.Pop ? " ✔" : " ✘") + " | " + Math.Round((ps - p.Cap) * 100.0 / p.Cap) + "% |");
        }
        File.WriteAllText(Path.Combine(outDir, "validacion.md"), val.ToString(), utf8);

        int fallas = val.ToString().Split('\n').Count(l => l.Contains("✘"));
        log.AppendLine("internos=" + I.Count + " penales=" + penales.Count + " pabellones=" + penales.Sum(p => p.Pabs.Count) + " delitos_catalogo=" + (delitos.Count - 1 + subs.Count) + " fallas_validacion=" + fallas);
        log.AppendLine("alertas_ejemplo: liberacion<=30d=" + I.Count(x => !x.Proc && !x.Perpetua && (x.FLiberacion - REF).TotalDays <= 30) +
            " pp_vence<=30d=" + I.Count(x => x.Proc && (x.FVencPP - REF).TotalDays <= 30 && x.FVencPP >= REF) + " pp_vencida=" + I.Count(x => x.Proc && x.FVencPP < REF));
        log.Append(Extras(outDir, penales, I));
        return log.ToString();
    }

    // ------------------------------------------------------------------ colecciones operativas (100 % simuladas)
    static string DT(DateTime d) { return "{\"$date\":\"" + d.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture) + "Z\"}"; }
    static string NombreSimple(char sx) { var pool = sx == 'M' ? NomH : NomM; return pool[R.Next(pool.Length)]; }
    static string Slug(string s)
    {
        var n = s.ToLowerInvariant().Normalize(NormalizationForm.FormD); var sb = new StringBuilder();
        foreach (char c in n) if (c >= 'a' && c <= 'z') sb.Append(c);
        return sb.ToString();
    }
    class Usuario { public string Id, Username, Nombres, ApPat, ApMat, Rol, PenalId; public DateTime Creado, UltimoAcceso; }

    static string Extras(string outDir, List<Penal> penales, List<Interno> I)
    {
        var utf8 = new UTF8Encoding(false);
        var log = new StringBuilder();

        // ---------------- usuarios
        var users = new List<Usuario>(); var usados = new HashSet<string>();
        Func<string, string, Usuario> NU = (rol, penal) =>
        {
            char sx = U() < 0.5 ? 'M' : 'F';
            var u = new Usuario { Rol = rol, PenalId = penal, Nombres = NombreSimple(sx), ApPat = Ap[R.Next(Ap.Length)], ApMat = Ap[R.Next(Ap.Length)] };
            string baseU = Slug(u.Nombres.Substring(0, 1)) + Slug(u.ApPat); string un = baseU; int k = 2;
            while (!usados.Add(un)) un = baseU + (k++);
            u.Username = un; u.Id = "USR" + (users.Count + 1).ToString("0000");
            u.Creado = new DateTime(2025, 3, 1).AddDays(R.Next(0, 200));
            u.UltimoAcceso = REF.AddDays(-R.Next(0, 10)).AddHours(R.Next(7, 19)).AddMinutes(R.Next(60));
            users.Add(u); return u;
        };
        for (int k = 0; k < 3; k++) NU("ADMIN_CENTRAL", null);
        for (int k = 0; k < 2; k++) NU("AUDITOR", null);
        foreach (var p in penales)
        {
            NU("DIRECTOR_PENAL", p.Id);
            int nOps = p.Pop < 200 ? 1 : p.Pop < 1000 ? 2 : p.Pop < 3000 ? 3 : p.Pop < 6000 ? 4 : 6;
            for (int k = 0; k < nOps; k++) NU("OPERADOR_REGISTRO", p.Id);
        }
        var directorDe = users.Where(u => u.Rol == "DIRECTOR_PENAL").ToDictionary(u => u.PenalId);
        var admins = users.Where(u => u.Rol == "ADMIN_CENTRAL").ToList();
        var auditores = users.Where(u => u.Rol == "AUDITOR").ToList();
        using (var w = new StreamWriter(Path.Combine(outDir, "usuarios.json"), false, utf8))
            foreach (var u in users)
                w.WriteLine("{\"_id\":" + Esc(u.Id) + ",\"username\":" + Esc(u.Username) + ",\"nombres\":" + Esc(u.Nombres) + ",\"apellido_paterno\":" + Esc(u.ApPat) + ",\"apellido_materno\":" + Esc(u.ApMat) +
                    ",\"correo\":" + Esc(u.Username + "@inpe-devsecops.test") + ",\"rol\":" + Esc(u.Rol) + ",\"penal_id\":" + (u.PenalId == null ? "null" : Esc(u.PenalId)) +
                    ",\"estado\":\"PENDIENTE_ACTIVACION\",\"password_hash\":null,\"mfa\":{\"habilitado\":false,\"secreto_cifrado\":null},\"intentos_fallidos\":0,\"bloqueado_hasta\":null" +
                    ",\"fecha_creacion\":" + DT(u.Creado) + ",\"ultimo_acceso\":" + DT(u.UltimoAcceso) + ",\"dato_ficticio\":true}");

        // ---------------- traslados
        Func<Penal, double> Hac = p => (p.Pop - p.Cap) * 100.0 / p.Cap;
        Func<Penal, char, bool> Aloja = (p, sx) => sx == 'M' ? p.Hombres > 0 : p.Mujeres > 0;
        string[] motivos = { "DESCONGESTIÓN", "DESCONGESTIÓN", "DESCONGESTIÓN", "SEGURIDAD", "ACERCAMIENTO FAMILIAR", "SALUD", "ORDEN JUDICIAL" };
        var tras = new StringBuilder(); int nt = 0; var cnt = new Dictionary<string, int>();
        Action<Interno, Penal, Penal, string, DateTime> T = (x, ori, des, estado, fsol) =>
        {
            nt++; if (!cnt.ContainsKey(estado)) cnt[estado] = 0; cnt[estado]++;
            var dir = directorDe[ori.Id]; var adm = admins[R.Next(admins.Count)];
            string motivo = motivos[R.Next(motivos.Length)];
            var sb = new StringBuilder();
            sb.Append("{\"_id\":").Append(Esc("TRA-" + nt.ToString("000000"))).Append(",\"codigo_interno\":").Append(Esc("INT-" + x.N.ToString("0000000")));
            sb.Append(",\"penal_origen_id\":").Append(Esc(ori.Id)).Append(",\"penal_destino_id\":").Append(Esc(des.Id));
            sb.Append(",\"motivo\":").Append(Esc(motivo)).Append(",\"estado\":").Append(Esc(estado));
            sb.Append(",\"recomendacion\":{\"generada_por_sistema\":").Append(motivo == "DESCONGESTIÓN" ? "true" : "false")
              .Append(",\"sobrepoblacion_origen_pct\":").Append(Math.Round(Hac(ori))).Append(",\"sobrepoblacion_destino_pct\":").Append(Math.Round(Hac(des))).Append("}");
            sb.Append(",\"solicitado_por\":").Append(Esc(dir.Id)).Append(",\"fecha_solicitud\":").Append(DT(fsol.AddHours(R.Next(8, 18))));
            if (estado == "PENDIENTE") sb.Append(",\"resuelto_por\":null,\"fecha_resolucion\":null,\"fecha_ejecucion\":null,\"observacion\":null");
            else
            {
                var fres = fsol.AddDays(R.Next(1, 15)); if (fres > REF) fres = REF;
                sb.Append(",\"resuelto_por\":").Append(Esc(adm.Id)).Append(",\"fecha_resolucion\":").Append(DT(fres.AddHours(R.Next(8, 18))));
                if (estado == "EJECUTADO") { var fe = fres.AddDays(R.Next(1, 20)); if (fe > REF) fe = REF; sb.Append(",\"fecha_ejecucion\":").Append(DT(fe.AddHours(R.Next(6, 14)))); }
                else sb.Append(",\"fecha_ejecucion\":null");
                sb.Append(",\"observacion\":").Append(estado == "RECHAZADO" ? Esc(R.Next(2) == 0 ? "El penal de destino no cuenta con pabellón disponible para el perfil del interno." : "Proceso judicial en curso requiere permanencia en el distrito judicial de origen.") : "null");
            }
            sb.Append(",\"dato_ficticio\":true}");
            tras.AppendLine(sb.ToString());
        };
        // ejecutados en los últimos 12 meses: el interno ya está en el penal de destino
        var candidatos = I.Where(x => (REF - x.FIngreso).TotalDays > 60).ToList(); Shuffle(candidatos);
        int ejec = 0;
        foreach (var x in candidatos)
        {
            if (ejec >= 2400) break;
            var origenes = penales.Where(p => p != x.P && p.Oficina == x.P.Oficina && Aloja(p, x.Sexo) && Hac(p) > Hac(x.P)).ToList();
            if (origenes.Count == 0) continue;
            var ori = PickW(origenes, p => Math.Max(1, Hac(p)));
            double maxDias = Math.Min(365, (REF - x.FIngreso).TotalDays - 30);
            T(x, ori, x.P, "EJECUTADO", REF.AddDays(-R.Next(20, (int)maxDias))); ejec++;
        }
        // pendientes, aprobados (por ejecutar) y rechazados: el interno sigue en el penal de origen
        foreach (var est in new[] { "PENDIENTE", "APROBADO", "RECHAZADO" })
        {
            int meta = est == "PENDIENTE" ? 420 : est == "APROBADO" ? 160 : 230;
            var desde = I.Where(x => Hac(x.P) > 100).ToList(); Shuffle(desde);
            foreach (var x in desde.Take(meta))
            {
                var destinos = penales.Where(p => p != x.P && Aloja(p, x.Sexo) && Hac(p) < Hac(x.P)).OrderBy(p => (p.Oficina == x.P.Oficina ? 0 : 1000) + Hac(p)).Take(3).ToList();
                if (destinos.Count == 0) continue;
                int dias = est == "PENDIENTE" ? R.Next(1, 25) : R.Next(10, 90);
                T(x, x.P, destinos[R.Next(destinos.Count)], est, REF.AddDays(-dias));
            }
        }
        File.WriteAllText(Path.Combine(outDir, "traslados.json"), tras.ToString(), utf8);

        // ---------------- alertas (estado al 31/01/2026, generadas por el motor)
        var ale = new StringBuilder(); int na = 0; var ca = new Dictionary<string, int>();
        Action<string, string, Penal, string, string, string, string> AL = (tipo, nivel, p, pab, interno, msg, rol) =>
        {
            na++; if (!ca.ContainsKey(tipo)) ca[tipo] = 0; ca[tipo]++;
            bool atendida = U() < 0.3; string dest = rol == "ADMIN_CENTRAL" ? admins[0].Id : directorDe[p.Id].Id;
            ale.AppendLine("{\"_id\":" + Esc("ALE-" + na.ToString("000000")) + ",\"tipo\":" + Esc(tipo) + ",\"nivel\":" + Esc(nivel) + ",\"penal_id\":" + Esc(p.Id) +
                ",\"pabellon_id\":" + (pab == null ? "null" : Esc(pab)) + ",\"codigo_interno\":" + (interno == null ? "null" : Esc(interno)) + ",\"mensaje\":" + Esc(msg) +
                ",\"destinatario_rol\":" + Esc(rol) + ",\"destinatario_id\":" + Esc(dest) + ",\"fecha_generacion\":" + DT(REF.AddHours(R.Next(0, 6))) +
                ",\"estado\":" + Esc(atendida ? "ATENDIDA" : "PENDIENTE") + ",\"atendida_por\":" + (atendida ? Esc(dest) : "null") + ",\"dato_ficticio\":true}");
        };
        foreach (var p in penales)
        {
            double h = Hac(p);
            if (h >= 20) AL("HACINAMIENTO_PENAL", h >= 100 ? "CRITICA" : "ALTA", p, null, null, string.Format(CultureInfo.InvariantCulture, "{0} supera su capacidad en {1:0}% ({2} internos para {3} plazas).", p.Nombre, h, p.Pop, p.Cap), "ADMIN_CENTRAL");
            foreach (var b in p.Pabs)
            {
                double o = b.Pop * 100.0 / Math.Max(1, b.Cap);
                if (o >= 90) AL("AFORO_PABELLON", o >= 100 ? "CRITICA" : "ALTA", p, b.Id, null, string.Format(CultureInfo.InvariantCulture, "{0} al {1:0}% de su aforo ({2}/{3}).", b.Nombre, o, b.Pop, b.Cap), "DIRECTOR_PENAL");
            }
        }
        foreach (var x in I.Where(x => !x.Proc && !x.Perpetua && (x.FLiberacion - REF).TotalDays <= 30))
            AL("LIBERACION_PROXIMA", "MEDIA", x.P, x.Pb.Id, "INT-" + x.N.ToString("0000000"), "Fecha de liberación estimada: " + x.FLiberacion.ToString("dd/MM/yyyy") + ". Verificar trámite de egreso.", "DIRECTOR_PENAL");
        foreach (var x in I.Where(x => x.Proc && x.FVencPP >= REF && (x.FVencPP - REF).TotalDays <= 30))
            AL("PRISION_PREVENTIVA_POR_VENCER", "ALTA", x.P, x.Pb.Id, "INT-" + x.N.ToString("0000000"), "La prisión preventiva vence el " + x.FVencPP.ToString("dd/MM/yyyy") + ". Comunicar al área legal y al juzgado.", "DIRECTOR_PENAL");
        File.WriteAllText(Path.Combine(outDir, "alertas.json"), ale.ToString(), utf8);

        // ---------------- auditoría (enero 2026), incluye un patrón sospechoso para probar alertas de seguridad
        var aud = new StringBuilder(); int ne = 0;
        var ops = users.Where(u => u.Rol == "OPERADOR_REGISTRO").ToList();
        var porPenal = I.GroupBy(x => x.P.Id).ToDictionary(g => g.Key, g => g.ToList());
        Action<DateTime, Usuario, string, string, string, string, string> EV = (f, u, accion, recurso, resultado, detalle, ip) =>
        {
            ne++;
            aud.AppendLine("{\"evento_id\":" + Esc("EVT-" + ne.ToString("0000000")) + ",\"fecha\":" + DT(f) + ",\"usuario_id\":" + Esc(u.Id) + ",\"username\":" + Esc(u.Username) +
                ",\"rol\":" + Esc(u.Rol) + ",\"penal_usuario\":" + (u.PenalId == null ? "null" : Esc(u.PenalId)) + ",\"ip\":" + Esc(ip) + ",\"accion\":" + Esc(accion) +
                ",\"recurso\":" + (recurso == null ? "null" : Esc(recurso)) + ",\"resultado\":" + Esc(resultado) + ",\"detalle\":" + (detalle == null ? "null" : Esc(detalle)) + "}");
        };
        Func<Usuario, string> IP = u => "10." + (u.PenalId == null ? 0 : int.Parse(u.PenalId.Substring(2))) + "." + R.Next(1, 20) + "." + R.Next(2, 250);
        var eventos = new List<Tuple<DateTime, Action>>();
        for (int dia = 1; dia <= 31; dia++)
        {
            var fecha = new DateTime(2026, 1, dia); bool finde = fecha.DayOfWeek == DayOfWeek.Saturday || fecha.DayOfWeek == DayOfWeek.Sunday;
            foreach (var u in users)
            {
                if (finde && U() < 0.8) continue;
                if (U() < 0.15) continue;
                string ip = IP(u);
                var t0 = fecha.AddHours(R.Next(7, 10)).AddMinutes(R.Next(60)).AddSeconds(R.Next(60));
                if (U() < 0.05) EV(t0.AddSeconds(-40), u, "LOGIN", null, "FALLIDO", "Contraseña incorrecta", ip);
                EV(t0, u, "LOGIN", null, "EXITO", "MFA verificado", ip);
                int acciones = u.Rol == "OPERADOR_REGISTRO" ? R.Next(4, 14) : u.Rol == "DIRECTOR_PENAL" ? R.Next(2, 7) : R.Next(1, 5);
                var t = t0;
                for (int a = 0; a < acciones; a++)
                {
                    t = t.AddMinutes(R.Next(3, 45)).AddSeconds(R.Next(60));
                    if (u.Rol == "OPERADOR_REGISTRO")
                    {
                        var x = porPenal[u.PenalId][R.Next(porPenal[u.PenalId].Count)]; string cod = "INT-" + x.N.ToString("0000000");
                        double r = U();
                        if (r < 0.60) EV(t, u, "CONSULTA_FICHA_INTERNO", cod, "EXITO", null, ip);
                        else if (r < 0.80) EV(t, u, "ACTUALIZA_SITUACION_JURIDICA", cod, "EXITO", "Actualización de datos procesales", ip);
                        else if (r < 0.92) EV(t, u, "REGISTRA_INGRESO", cod, "EXITO", null, ip);
                        else EV(t, u, "REGISTRA_EGRESO", cod, "EXITO", null, ip);
                    }
                    else if (u.Rol == "DIRECTOR_PENAL")
                    {
                        double r = U();
                        if (r < 0.5) EV(t, u, "CONSULTA_TABLERO_OCUPACION", u.PenalId, "EXITO", null, ip);
                        else if (r < 0.75) EV(t, u, "ATIENDE_ALERTA", u.PenalId, "EXITO", null, ip);
                        else if (r < 0.9) EV(t, u, "EXPORTA_REPORTE", u.PenalId, "EXITO", "Reporte agregado de ocupación (PDF)", ip);
                        else EV(t, u, "SOLICITA_TRASLADO", u.PenalId, "EXITO", null, ip);
                    }
                    else if (u.Rol == "ADMIN_CENTRAL")
                    {
                        double r = U();
                        if (r < 0.5) EV(t, u, "CONSULTA_TABLERO_NACIONAL", null, "EXITO", null, ip);
                        else if (r < 0.8) EV(t, u, "RESUELVE_TRASLADO", null, "EXITO", null, ip);
                        else EV(t, u, "GESTIONA_USUARIO", users[R.Next(users.Count)].Id, "EXITO", "Actualización de rol o estado", ip);
                    }
                    else EV(t, u, "CONSULTA_BITACORA", null, "EXITO", null, ip);
                }
                EV(t.AddMinutes(R.Next(5, 120)), u, "LOGOUT", null, "EXITO", null, ip);
            }
        }
        // patrón sospechoso: intentos de fuerza bruta desde IP externa y un operador con consultas masivas de madrugada fuera de su penal
        var victima = ops[R.Next(ops.Count)];
        var tb = new DateTime(2026, 1, 18, 3, 12, 0);
        for (int k = 0; k < 7; k++) EV(tb.AddSeconds(k * 9), victima, "LOGIN", null, k < 5 ? "FALLIDO" : "BLOQUEADO", k < 5 ? "Contraseña incorrecta" : "Cuenta bloqueada 15 minutos (RNF06)", "181.65." + R.Next(1, 250) + "." + R.Next(2, 250));
        var sosp = ops.First(u => u != victima); var ts = new DateTime(2026, 1, 24, 2, 5, 0); string ipS = IP(sosp);
        EV(ts, sosp, "LOGIN", null, "EXITO", "MFA verificado", ipS);
        var otro = penales.First(p => p.Id != sosp.PenalId && p.Pop > 3000);
        for (int k = 0; k < 40; k++)
        {
            var x = porPenal[sosp.PenalId][R.Next(porPenal[sosp.PenalId].Count)];
            EV(ts.AddSeconds(20 + k * 6), sosp, "CONSULTA_FICHA_INTERNO", "INT-" + x.N.ToString("0000000"), "EXITO", null, ipS);
        }
        for (int k = 0; k < 6; k++)
        {
            var x = porPenal[otro.Id][R.Next(porPenal[otro.Id].Count)];
            EV(ts.AddSeconds(300 + k * 5), sosp, "CONSULTA_FICHA_INTERNO", "INT-" + x.N.ToString("0000000"), "DENEGADO", "403: el interno no pertenece al penal del usuario (RNF08)", ipS);
        }
        File.WriteAllText(Path.Combine(outDir, "auditoria.json"), aud.ToString(), utf8);

        log.AppendLine("usuarios=" + users.Count + " (admin=" + admins.Count + ", auditor=" + auditores.Count + ", director=" + directorDe.Count + ", operador=" + ops.Count + ")");
        log.AppendLine("traslados=" + nt + " " + string.Join(", ", cnt.Select(kv => kv.Key + "=" + kv.Value)));
        log.AppendLine("alertas=" + na + " " + string.Join(", ", ca.Select(kv => kv.Key + "=" + kv.Value)));
        log.AppendLine("auditoria_eventos=" + ne + " (incluye fuerza bruta contra " + victima.Username + " y consultas masivas de " + sosp.Username + ")");
        return log.ToString();
    }
}
